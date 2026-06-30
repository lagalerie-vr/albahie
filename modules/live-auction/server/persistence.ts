// All DB access for the authoritative server. Uses the Supabase SERVICE ROLE
// (bypasses RLS) — this is the ONLY writer of bid state, which is what makes the
// engine authoritative rather than pub/sub.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AbsenteeProxy, IncrementRung, LotState } from "../engine/types";
import type { BidChannel } from "../engine/types";
import { emitPlatformEventWith, recordChargeWith } from "../adapters/platform";

let svcClient: SupabaseClient | null = null;
function svc(): SupabaseClient {
  if (!svcClient) {
    svcClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return svcClient;
}
const aud = () => svc().schema("auction");

export interface LoadedLot {
  state: LotState;
  ladder: IncrementRung[];
  softCloseMs: number;
  sourceRef: string | null;
  lotNo: number;
  title: string;
}

export async function loadLot(lotId: string): Promise<LoadedLot | null> {
  const { data: lot } = await aud()
    .from("lots")
    .select(
      "id, auction_id, lot_no, title, status, start_price_cents, reserve_cents, current_price_cents, high_bidder_registration, high_bidder_paddle, source_ref",
    )
    .eq("id", lotId)
    .single();
  if (!lot) return null;

  const { data: auc } = await aud()
    .from("auctions")
    .select("increments, soft_close_seconds")
    .eq("id", lot.auction_id)
    .single();

  return {
    state: {
      lotId: lot.id,
      auctionId: lot.auction_id,
      status: lot.status,
      startPriceCents: Number(lot.start_price_cents),
      reserveCents: lot.reserve_cents == null ? null : Number(lot.reserve_cents),
      currentPriceCents:
        lot.current_price_cents == null ? null : Number(lot.current_price_cents),
      highBidderRegistrationId: lot.high_bidder_registration,
      highBidderPaddle: lot.high_bidder_paddle,
      endsAt: null,
    },
    ladder: (auc?.increments as IncrementRung[]) ?? [],
    softCloseMs: (auc?.soft_close_seconds ?? 30) * 1000,
    sourceRef: lot.source_ref,
    lotNo: lot.lot_no,
    title: lot.title,
  };
}

export async function loadProxies(lotId: string): Promise<AbsenteeProxy[]> {
  const { data } = await aud()
    .from("absentee_bids")
    .select(
      "max_amount_cents, created_at, registration:registrations ( id, paddle_no, status )",
    )
    .eq("lot_id", lotId)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as unknown as {
    max_amount_cents: number;
    registration: { id: string; paddle_no: number; status: string } | null;
  }[];

  return rows
    .filter((r) => r.registration && r.registration.status === "approved")
    .map((r, i) => ({
      registrationId: r.registration!.id,
      paddleNo: r.registration!.paddle_no,
      maxAmountCents: Number(r.max_amount_cents),
      seq: i,
    }));
}

export async function loadRegistration(
  auctionId: string,
  userId: string,
): Promise<{ id: string; paddleNo: number; status: string } | null> {
  const { data } = await aud()
    .from("registrations")
    .select("id, paddle_no, status")
    .eq("auction_id", auctionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, paddleNo: data.paddle_no, status: data.status };
}

export async function registrationByPaddle(
  auctionId: string,
  paddleNo: number,
): Promise<{ id: string; paddleNo: number; status: string } | null> {
  const { data } = await aud()
    .from("registrations")
    .select("id, paddle_no, status")
    .eq("auction_id", auctionId)
    .eq("paddle_no", paddleNo)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, paddleNo: data.paddle_no, status: data.status };
}

export async function saveLot(
  state: LotState,
  extra: {
    winningAmountCents?: number | null;
    openedAt?: string;
    closedAt?: string;
  } = {},
): Promise<void> {
  await aud()
    .from("lots")
    .update({
      status: state.status,
      current_price_cents: state.currentPriceCents,
      high_bidder_paddle: state.highBidderPaddle,
      high_bidder_registration: state.highBidderRegistrationId,
      ...(extra.winningAmountCents !== undefined
        ? { winning_amount_cents: extra.winningAmountCents }
        : {}),
      ...(extra.openedAt ? { opened_at: extra.openedAt } : {}),
      ...(extra.closedAt ? { closed_at: extra.closedAt } : {}),
    })
    .eq("id", state.lotId);
}

export interface AuditRow {
  auctionId: string;
  lotId: string;
  registrationId: string | null;
  paddleNo: number | null;
  channel: BidChannel;
  requestedAmountCents: number | null;
  resultingPriceCents: number | null;
  status: "accepted" | "rejected";
  reason: string | null;
  idempotencyKey: string | null;
  actorUserId: string | null;
}

export async function appendAudit(row: AuditRow): Promise<void> {
  await aud()
    .from("bid_audit")
    .insert({
      auction_id: row.auctionId,
      lot_id: row.lotId,
      registration_id: row.registrationId,
      paddle_no: row.paddleNo,
      channel: row.channel,
      requested_amount_cents: row.requestedAmountCents,
      resulting_price_cents: row.resultingPriceCents,
      status: row.status,
      reason: row.reason,
      idempotency_key: row.idempotencyKey,
      actor_user_id: row.actorUserId,
    });
}

export async function appendEvent(
  lotId: string,
  type: string,
  actorUserId: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await aud()
    .from("lot_events")
    .insert({ lot_id: lotId, type, actor_user_id: actorUserId, payload });
}

export async function emitLotSold(args: {
  auctionId: string;
  lotId: string;
  sourceRef: string | null;
  winnerUserId: string | null;
  paddleNo: number | null;
  amountCents: number;
}): Promise<void> {
  if (args.winnerUserId) {
    await recordChargeWith(svc(), args.winnerUserId, args.lotId, args.amountCents);
  }
  await emitPlatformEventWith(svc(), {
    type: "auction.lot_sold",
    at: new Date().toISOString(),
    auctionId: args.auctionId,
    lotId: args.lotId,
    sourceRef: args.sourceRef,
    userId: args.winnerUserId ?? undefined,
    paddleNo: args.paddleNo ?? undefined,
    amountCents: args.amountCents,
  });
}

export async function winnerUserId(
  registrationId: string | null,
): Promise<string | null> {
  if (!registrationId) return null;
  const { data } = await aud()
    .from("registrations")
    .select("user_id")
    .eq("id", registrationId)
    .single();
  return data?.user_id ?? null;
}
