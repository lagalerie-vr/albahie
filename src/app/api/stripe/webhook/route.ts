import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook — settles our invoice when its Stripe invoice is paid.
 * Configure in Stripe (or `stripe listen --forward-to .../api/stripe/webhook`)
 * and set STRIPE_WEBHOOK_SECRET. Without a secret we trust the body (dev only).
 */
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 400 });
  }
  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    event =
      secret && sig
        ? stripe.webhooks.constructEvent(body, sig, secret)
        : (JSON.parse(body) as Stripe.Event);
  } catch (e) {
    return NextResponse.json(
      { error: `webhook signature failed: ${e instanceof Error ? e.message : ""}` },
      { status: 400 },
    );
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const admin = createAdminClient();
    await admin
      .from("invoices")
      .update({
        status: "settled",
        stripe_status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("stripe_invoice_id", invoice.id);
  }

  return NextResponse.json({ received: true });
}
