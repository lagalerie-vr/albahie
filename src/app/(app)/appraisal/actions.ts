"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export type DecisionResult = { error?: string };

function revalidate(itemId: string) {
  revalidatePath("/appraisal");
  revalidatePath("/consignments");
  revalidatePath(`/consignments/items/${itemId}`);
}

async function currentDue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("consignment_items")
    .select("appraisal_due_at")
    .eq("id", itemId)
    .single();
  return data?.appraisal_due_at ?? null;
}

export type RoutingTrack = "inventory" | "auction" | "private";

export interface AcceptPayload {
  track: RoutingTrack;
  auctionId?: string | null;
  commission?: number | null;
  reservePrice?: number | null;
  askingPrice?: number | null;
  privateMonths?: number | null;
  note?: string;
}

export async function acceptItem(
  itemId: string,
  payload: AcceptPayload,
): Promise<DecisionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const prevDue = await currentDue(supabase, itemId);

  const { track } = payload;
  const now = new Date().toISOString();
  const routed = track === "auction" || track === "private";

  const status =
    track === "auction"
      ? "routed_auction"
      : track === "private"
        ? "routed_private"
        : "accepted";

  const { error } = await supabase
    .from("consignment_items")
    .update({
      status,
      routing_track: routed ? track : null,
      auction_id: track === "auction" ? (payload.auctionId ?? null) : null,
      seller_commission: payload.commission ?? null,
      reserve_price: track === "auction" ? (payload.reservePrice ?? null) : null,
      asking_price: track === "private" ? (payload.askingPrice ?? null) : null,
      private_sale_months:
        track === "private" ? (payload.privateMonths ?? null) : null,
      appraisal_decided_at: now,
      appraisal_decided_by: profile.id,
      // Setting this triggers agreement-number generation in the DB.
      ...(routed ? { agreement_generated_at: now } : {}),
    })
    .eq("id", itemId);
  if (error) return { error: error.message };

  // Build a human-readable activity detail.
  let auctionName: string | null = null;
  if (track === "auction" && payload.auctionId) {
    const { data: a } = await supabase
      .from("auctions")
      .select("name")
      .eq("id", payload.auctionId)
      .single();
    auctionName = a?.name ?? null;
  }

  const summary =
    track === "auction"
      ? "Accepted — routed to auction"
      : track === "private"
        ? "Accepted — routed to private sale"
        : "Accepted — held in inventory";

  const detailBits: string[] = [];
  if (auctionName) detailBits.push(auctionName);
  if (payload.commission != null)
    detailBits.push(`${payload.commission}% commission`);
  if (track === "auction" && payload.reservePrice != null)
    detailBits.push(`reserve $${payload.reservePrice}`);
  if (track === "private" && payload.askingPrice != null)
    detailBits.push(`asking $${payload.askingPrice}`);
  if (track === "private" && payload.privateMonths != null)
    detailBits.push(`${payload.privateMonths}-month period`);

  await supabase.from("appraisal_events").insert({
    item_id: itemId,
    action: "accepted",
    decided_by: profile.id,
    note: payload.note?.trim() || null,
    previous_due_at: prevDue,
  });

  await supabase.from("item_activity").insert({
    item_id: itemId,
    kind: "accepted",
    summary,
    detail: detailBits.length ? detailBits.join(" · ") : null,
    actor: profile.id,
  });

  revalidate(itemId);
  return {};
}

export async function createAuctionEvent(
  name: string,
  saleDate?: string,
): Promise<{ id?: string; error?: string }> {
  const trimmed = name?.trim();
  if (!trimmed) return { error: "Auction name is required." };

  await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("auctions")
    .insert({
      name: trimmed,
      sale_date: saleDate?.trim() ? saleDate : null,
      status: "upcoming",
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create." };

  revalidatePath("/appraisal");
  return { id: data.id };
}

export async function rejectItem(
  itemId: string,
  reason: string,
): Promise<DecisionResult> {
  const trimmed = reason?.trim();
  if (!trimmed) return { error: "A reason is required to reject an item." };

  const profile = await requireProfile();
  const supabase = await createClient();
  const prevDue = await currentDue(supabase, itemId);

  const { error } = await supabase
    .from("consignment_items")
    .update({
      status: "declined",
      decline_reason: trimmed,
      appraisal_decided_at: new Date().toISOString(),
      appraisal_decided_by: profile.id,
    })
    .eq("id", itemId);
  if (error) return { error: error.message };

  await supabase.from("appraisal_events").insert({
    item_id: itemId,
    action: "rejected",
    decided_by: profile.id,
    note: trimmed,
    previous_due_at: prevDue,
  });

  await supabase.from("item_activity").insert({
    item_id: itemId,
    kind: "rejected",
    summary: "Rejected — return to consignor",
    detail: trimmed,
    actor: profile.id,
  });

  revalidate(itemId);
  return {};
}

export async function extendItem(
  itemId: string,
  weeks: number,
  note?: string,
): Promise<DecisionResult> {
  const w = Math.trunc(weeks);
  if (!Number.isFinite(w) || w < 1 || w > 12) {
    return { error: "Extensions are granted in 1–12 week increments." };
  }

  const profile = await requireProfile();
  const supabase = await createClient();
  const prevDue = await currentDue(supabase, itemId);

  // Extend from the later of (now, current due) so the next step is always
  // in the future — no item ever sits silently past its date.
  const now = Date.now();
  const base = Math.max(now, prevDue ? new Date(prevDue).getTime() : now);
  const newDue = new Date(base + w * 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: item } = await supabase
    .from("consignment_items")
    .select("extension_count")
    .eq("id", itemId)
    .single();

  const { error } = await supabase
    .from("consignment_items")
    .update({
      status: "extended_review",
      appraisal_due_at: newDue,
      extension_count: (item?.extension_count ?? 0) + 1,
    })
    .eq("id", itemId);
  if (error) return { error: error.message };

  await supabase.from("appraisal_events").insert({
    item_id: itemId,
    action: "extended",
    decided_by: profile.id,
    note: note?.trim() || null,
    extension_weeks: w,
    previous_due_at: prevDue,
    new_due_at: newDue,
  });

  await supabase.from("item_activity").insert({
    item_id: itemId,
    kind: "extended",
    summary: `Review extended ${w} week${w === 1 ? "" : "s"}`,
    detail: `New review date ${newDue.slice(0, 10)}${note?.trim() ? ` · ${note.trim()}` : ""}`,
    actor: profile.id,
  });

  revalidate(itemId);
  return {};
}
