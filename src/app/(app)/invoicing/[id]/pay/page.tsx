import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Lock, ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { fmtCents, type Invoice } from "@/lib/invoices";
import { PayButton } from "@/components/invoicing/PayButton";

export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!data) notFound();
  const inv = data as Invoice;
  const settled = inv.status === "settled";

  return (
    <div className="mx-auto max-w-md">
      <Link
        href="/invoicing"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Invoicing
      </Link>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="border-b border-neutral-100 bg-neutral-50 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs uppercase tracking-wide text-neutral-400">AlBahie Auction House</p>
          <h1 className="mt-0.5 text-lg font-semibold">
            Invoice {inv.invoice_number}
          </h1>
          <p className="text-sm text-neutral-500">
            {inv.buyer_name ?? "Buyer"}
            {inv.paddle_no != null && ` · paddle #${inv.paddle_no}`}
          </p>
        </div>

        <div className="space-y-2 px-6 py-5 text-sm">
          <Row label={inv.lot_title ?? "Lot"} value={fmtCents(inv.hammer_cents)} />
          <Row label="Buyer's premium" value={fmtCents(inv.premium_cents)} muted />
          <div className="my-2 border-t border-neutral-100 dark:border-neutral-800" />
          <Row label="Total due" value={fmtCents(inv.total_cents)} strong />
        </div>

        <div className="px-6 pb-6">
          {settled ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-green-50 py-6 text-center dark:bg-green-950/40">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              <p className="font-semibold text-green-700 dark:text-green-300">Payment received</p>
              <p className="text-xs text-green-700/70 dark:text-green-300/70">
                Invoice settled{inv.paid_at ? ` on ${new Date(inv.paid_at).toLocaleString()}` : ""}.
              </p>
            </div>
          ) : (
            <>
              <PayButton id={inv.id} amount={fmtCents(inv.total_cents)} />
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
                <Lock className="h-3 w-3" /> Mock payment — settles the invoice instantly.
              </p>
            </>
          )}

          <a
            href={`/invoicing/${inv.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <FileText className="h-4 w-4" /> View invoice (PDF)
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-neutral-500" : strong ? "font-semibold" : ""}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-lg font-semibold" : muted ? "text-neutral-500" : ""}`}>
        {value}
      </span>
    </div>
  );
}
