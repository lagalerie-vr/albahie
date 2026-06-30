"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { fmtCents, type Invoice } from "@/lib/invoices";
import { sendMail, invoiceEmailHtml } from "@live-auction/adapters/email";

/** Mark an invoice settled (mock payment completed). */
export async function settleInvoice(id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "settled", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/invoicing");
  revalidatePath(`/invoicing/${id}/pay`);
  return { ok: true };
}

/**
 * Create (or return) a Stripe invoice for one of our invoices and store the
 * hosted payment URL. Uses Stripe Invoicing in whatever mode the key is in
 * (test keys → test mode). Returns the hosted invoice URL to open.
 */
export async function createStripeInvoice(
  id: string,
): Promise<{ error?: string; url?: string }> {
  await requireProfile();
  if (!stripeConfigured()) {
    return { error: "Stripe isn't configured. Add STRIPE_SECRET_KEY to .env.local and restart." };
  }
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!data) return { error: "Invoice not found." };
  const inv = data as Invoice;

  // Already linked → just return the stored hosted URL.
  if (inv.stripe_invoice_id) return { url: inv.payment_link ?? undefined };

  try {
    const stripe = getStripe();

    let email: string | undefined;
    if (inv.client_id) {
      const { data: c } = await supabase
        .from("consignors")
        .select("email")
        .eq("id", inv.client_id)
        .single();
      email = c?.email ?? undefined;
    }

    const customer = await stripe.customers.create({
      name: inv.buyer_name ?? "Auction buyer",
      email,
      metadata: { erp_client_id: inv.client_id ?? "" },
    });

    const sInvoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: 7,
      description: `AlBahie Auction — ${inv.lot_title ?? "Lot"}`,
      metadata: { erp_invoice_id: inv.id, lot_id: inv.lot_id ?? "" },
    });

    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: sInvoice.id,
      amount: inv.hammer_cents,
      currency: "usd",
      description: inv.lot_title ?? "Hammer price",
    });
    if (inv.premium_cents > 0) {
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: sInvoice.id,
        amount: inv.premium_cents,
        currency: "usd",
        description: "Buyer's premium",
      });
    }

    const finalized = await stripe.invoices.finalizeInvoice(sInvoice.id);

    await supabase
      .from("invoices")
      .update({
        stripe_invoice_id: finalized.id,
        stripe_customer_id: customer.id,
        stripe_status: finalized.status ?? null,
        payment_link: finalized.hosted_invoice_url ?? inv.payment_link,
      })
      .eq("id", inv.id);

    revalidatePath("/invoicing");
    return { url: finalized.hosted_invoice_url ?? undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Stripe error creating invoice." };
  }
}

/** Email the buyer their invoice payment link (free SMTP). */
export async function emailInvoiceLink(
  id: string,
): Promise<{ error?: string; ok?: true }> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*, client:consignors ( email )")
    .eq("id", id)
    .single();
  if (!data) return { error: "Invoice not found." };
  const inv = data as Invoice & { client: { email: string | null } | null };
  const email = inv.client?.email ?? null;
  if (!email) return { error: "No email on file for this buyer (add one in Clients)." };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const link = inv.payment_link ?? `${site}/invoicing/${inv.id}/pay`;
  const res = await sendMail({
    to: email,
    subject: `Your AlBahie invoice ${inv.invoice_number ?? ""} — payment link`,
    html: invoiceEmailHtml({
      buyerName: inv.buyer_name,
      invoiceNumber: inv.invoice_number,
      lotTitle: inv.lot_title,
      totalLabel: fmtCents(inv.total_cents),
      link,
    }),
  });
  if (res.skipped) {
    return { error: "Email isn't configured — add SMTP_HOST/USER/PASS to .env.local and restart." };
  }
  if (res.error) return { error: res.error };
  return { ok: true };
}

/** Pull the latest status from Stripe and settle our invoice if it's paid. */
export async function syncStripeInvoice(
  id: string,
): Promise<{ error?: string; paid?: boolean; status?: string }> {
  await requireProfile();
  if (!stripeConfigured()) return { error: "Stripe isn't configured." };
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, stripe_invoice_id")
    .eq("id", id)
    .single();
  if (!inv?.stripe_invoice_id) return { error: "No Stripe invoice for this record yet." };

  try {
    const s = await getStripe().invoices.retrieve(inv.stripe_invoice_id);
    const paid = s.status === "paid";
    await supabase
      .from("invoices")
      .update({
        stripe_status: s.status ?? null,
        ...(paid ? { status: "settled", paid_at: new Date().toISOString() } : {}),
      })
      .eq("id", id);
    revalidatePath("/invoicing");
    return { paid, status: s.status ?? undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Stripe error." };
  }
}
