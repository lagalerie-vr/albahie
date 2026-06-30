// Shared host-side effects, parameterised by a Supabase client so both the
// Next (cookie) adapter and the WS server (service-role) can reuse them.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformEvent } from "./types";
import { sendMail, invoiceEmailHtml } from "./email";

export async function recordChargeWith(
  _supabase: SupabaseClient,
  userId: string,
  lotId: string,
  amountCents: number,
): Promise<void> {
  // Phase 1: payments are the host's responsibility. The module only requests
  // the charge; here we log it. A real host impl would call its billing service.
  console.log(
    `[host] charge requested user=${userId} lot=${lotId} amount=${amountCents}c`,
  );
}

// Buyer's premium added on top of the hammer price. Kept here (not imported
// from @/) so the standalone WS server's tsx runtime needs no path aliases.
const BUYER_PREMIUM_RATE = 0.2;

export async function emitPlatformEventWith(
  supabase: SupabaseClient,
  event: PlatformEvent,
): Promise<void> {
  if (event.type === "auction.lot_sold") {
    // Reflect the outcome onto the linked host item, if any.
    if (event.sourceRef) {
      await supabase
        .from("consignment_items")
        .update({ status: "sold" })
        .eq("id", event.sourceRef);
      await supabase.from("item_activity").insert({
        item_id: event.sourceRef,
        kind: "sold",
        summary: "Sold at auction",
        detail:
          event.amountCents != null
            ? `$${Math.round(event.amountCents / 100).toLocaleString()} · paddle ${event.paddleNo ?? "—"}`
            : null,
      });
    }
    // Auto-create the buyer invoice.
    await createInvoiceForSale(supabase, event);
    return;
  }
  console.log(`[host] platformEvent ${event.type}`, event);
}

/** Create an unpaid invoice (+ mock payment link) for a sold lot. Idempotent. */
async function createInvoiceForSale(
  supabase: SupabaseClient,
  event: PlatformEvent,
): Promise<void> {
  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("lot_id", event.lotId)
    .maybeSingle();
  if (existing) return;

  const { data: lot } = await supabase
    .schema("auction")
    .from("lots")
    .select("title, high_bidder_registration")
    .eq("id", event.lotId)
    .single();

  const regId = (lot?.high_bidder_registration as string | null) ?? null;
  let clientId: string | null = null;
  let buyerName: string | null = null;
  let buyerEmail: string | null = null;
  let paddleNo: number | null = event.paddleNo ?? null;

  if (regId) {
    const { data: reg } = await supabase
      .schema("auction")
      .from("registrations")
      .select("client_id, user_id, paddle_no")
      .eq("id", regId)
      .single();
    if (reg) {
      paddleNo = (reg.paddle_no as number | null) ?? paddleNo;
      if (reg.client_id) {
        clientId = reg.client_id as string;
        const { data: c } = await supabase
          .from("consignors")
          .select("full_name, email")
          .eq("id", clientId)
          .single();
        buyerName = c?.full_name ?? null;
        buyerEmail = c?.email ?? null;
      } else if (reg.user_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", reg.user_id)
          .single();
        buyerName = p?.full_name || p?.email || null;
        buyerEmail = p?.email ?? null;
      }
    }
  }

  const hammer = event.amountCents ?? 0;
  const premium = Math.round(hammer * BUYER_PREMIUM_RATE);
  const total = hammer + premium;

  const { data: inv } = await supabase
    .from("invoices")
    .insert({
      auction_id: event.auctionId,
      lot_id: event.lotId,
      registration_id: regId,
      client_id: clientId,
      buyer_name: buyerName,
      paddle_no: paddleNo,
      lot_title: lot?.title ?? null,
      hammer_cents: hammer,
      premium_cents: premium,
      total_cents: total,
      status: "unpaid",
    })
    .select("id, invoice_number")
    .single();

  if (inv) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const link = `${site}/invoicing/${inv.id}/pay`;
    await supabase.from("invoices").update({ payment_link: link }).eq("id", inv.id);

    // Notify the buyer with the payment link (best-effort; never blocks a sale).
    if (buyerEmail) {
      const totalLabel = `$${Math.round(total / 100).toLocaleString()}`;
      const res = await sendMail({
        to: buyerEmail,
        subject: `Your AlBahie invoice ${invNumber(inv)} — payment link`,
        html: invoiceEmailHtml({
          buyerName,
          invoiceNumber: invNumber(inv),
          lotTitle: lot?.title ?? null,
          totalLabel,
          link,
        }),
      });
      if (res.error) console.error(`[host] sale email failed: ${res.error}`);
      else if (res.ok) console.log(`[host] sale email sent to ${buyerEmail}`);
    }
  }
}

function invNumber(inv: { invoice_number?: string | null }): string | null {
  return inv.invoice_number ?? null;
}
