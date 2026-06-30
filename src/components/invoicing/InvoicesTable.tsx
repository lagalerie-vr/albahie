"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Check, Loader2, CreditCard, RefreshCw, FileText, Mail, MessageCircle } from "lucide-react";
import {
  settleInvoice,
  createStripeInvoice,
  syncStripeInvoice,
  emailInvoiceLink,
} from "@/app/(app)/invoicing/actions";
import { fmtCents, type Invoice } from "@/lib/invoices";

export interface InvoiceRow extends Invoice {
  client: { email: string | null; phone: string | null } | null;
}

const control =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export function InvoicesTable({
  invoices,
  stripeEnabled,
}: {
  invoices: InvoiceRow[];
  stripeEnabled: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"all" | "unpaid" | "settled">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function emailLink(id: string) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    const res = await emailInvoiceLink(id);
    setBusyId(null);
    if (res.error) setError(res.error);
    else setNotice("Invoice emailed to the buyer.");
  }

  function whatsappUrl(i: InvoiceRow): string | null {
    const digits = (i.client?.phone ?? "").replace(/\D/g, "");
    if (!digits) return null;
    const link =
      i.payment_link ?? `${window.location.origin}/invoicing/${i.id}/pay`;
    const msg =
      `Hello ${i.buyer_name ?? ""}, your AlBahie invoice ${i.invoice_number ?? ""} ` +
      `for "${i.lot_title ?? "your lot"}" is ready. Total ${fmtCents(i.total_cents)}. ` +
      `Pay here: ${link}`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  }

  const filtered = useMemo(
    () => invoices.filter((i) => status === "all" || i.status === status),
    [invoices, status],
  );

  async function settle(id: string) {
    setBusyId(id);
    await settleInvoice(id);
    setBusyId(null);
    router.refresh();
  }

  async function createStripe(id: string) {
    setBusyId(id);
    setError(null);
    const res = await createStripeInvoice(id);
    setBusyId(null);
    if (res.error) return setError(res.error);
    if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    router.refresh();
  }

  async function sync(id: string) {
    setBusyId(id);
    setError(null);
    const res = await syncStripeInvoice(id);
    setBusyId(null);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={control}>
          <option value="all">All invoices</option>
          <option value="unpaid">Outstanding</option>
          <option value="settled">Settled</option>
        </select>
        <span className="text-xs text-neutral-500">{filtered.length} invoice{filtered.length === 1 ? "" : "s"}</span>
        <span className="ml-auto text-xs text-neutral-400">
          {stripeEnabled ? "Payments via Stripe" : "Mock payments"}
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {notice}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No invoices yet. They appear here automatically when a lot is sold.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Buyer</th>
                <th className="px-4 py-3 font-medium">Lot</th>
                <th className="px-4 py-3 text-right font-medium">Hammer</th>
                <th className="px-4 py-3 text-right font-medium">Premium</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
              {filtered.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-mono text-xs">
                    <a
                      href={`/invoicing/${i.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {i.invoice_number ?? "—"}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {i.buyer_name ?? "—"}
                    {i.paddle_no != null && (
                      <span className="ml-1 text-xs text-neutral-400">#{i.paddle_no}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{i.lot_title ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtCents(i.hammer_cents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-500">{fmtCents(i.premium_cents)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{fmtCents(i.total_cents)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3 text-xs font-medium">
                      {i.status === "unpaid" ? (
                        <>
                          {stripeEnabled ? (
                            i.stripe_invoice_id ? (
                              <>
                                <a
                                  href={i.payment_link ?? "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  <CreditCard className="h-3.5 w-3.5" /> Pay with Stripe
                                </a>
                                <button
                                  onClick={() => sync(i.id)}
                                  disabled={busyId === i.id}
                                  className="inline-flex items-center gap-1 text-neutral-600 hover:underline disabled:opacity-50 dark:text-neutral-300"
                                >
                                  {busyId === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                  Sync
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => createStripe(i.id)}
                                disabled={busyId === i.id}
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                              >
                                {busyId === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                                Create Stripe invoice
                              </button>
                            )
                          ) : (
                            <a
                              href={`/invoicing/${i.id}/pay`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Payment link
                            </a>
                          )}
                          <button
                            onClick={() => emailLink(i.id)}
                            disabled={busyId === i.id}
                            title="Email the payment link to the buyer"
                            className="inline-flex items-center gap-1 text-neutral-600 hover:underline disabled:opacity-50 dark:text-neutral-300"
                          >
                            <Mail className="h-3.5 w-3.5" /> Email
                          </button>
                          {whatsappUrl(i) && (
                            <a
                              href={whatsappUrl(i)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Send the payment link via WhatsApp"
                              className="inline-flex items-center gap-1 text-green-600 hover:underline"
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                            </a>
                          )}
                          <button
                            onClick={() => settle(i.id)}
                            disabled={busyId === i.id}
                            className="inline-flex items-center gap-1 text-green-600 hover:underline disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Mark settled
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-neutral-400">
                            {i.paid_at ? `Paid ${new Date(i.paid_at).toLocaleDateString()}` : "Settled"}
                          </span>
                          <a
                            href={`/invoicing/${i.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <FileText className="h-3.5 w-3.5" /> Invoice PDF
                          </a>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "unpaid" | "settled" }) {
  return status === "settled" ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium uppercase text-green-700 dark:bg-green-950 dark:text-green-400">
      Settled
    </span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700 dark:bg-amber-950 dark:text-amber-400">
      Unpaid
    </span>
  );
}
