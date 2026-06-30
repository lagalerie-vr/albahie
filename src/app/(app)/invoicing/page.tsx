import { Receipt, CircleDollarSign, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { stripeConfigured } from "@/lib/stripe";
import { fmtCents } from "@/lib/invoices";
import { InvoicesTable, type InvoiceRow } from "@/components/invoicing/InvoicesTable";

export default async function InvoicingPage() {
  await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("invoices")
    .select("*, client:consignors ( email, phone )")
    .order("created_at", { ascending: false });
  const invoices = (data ?? []) as InvoiceRow[];

  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const outstanding = unpaid.reduce((s, i) => s + i.total_cents, 0);
  const settledTotal = invoices
    .filter((i) => i.status === "settled")
    .reduce((s, i) => s + i.total_cents, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Invoicing &amp; Payments</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Invoices are created automatically when a lot is hammered. Settle them via the
          payment link.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi icon={Receipt} label="Outstanding invoices" value={String(unpaid.length)} />
        <Kpi icon={CircleDollarSign} label="Outstanding amount" value={fmtCents(outstanding)} />
        <Kpi icon={CheckCircle2} label="Settled to date" value={fmtCents(settledTotal)} />
      </div>

      <InvoicesTable invoices={invoices} stripeEnabled={stripeConfigured()} />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{label}</span>
        <Icon className="h-4 w-4 text-neutral-400" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
