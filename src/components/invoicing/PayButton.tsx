"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CreditCard } from "lucide-react";
import { settleInvoice } from "@/app/(app)/invoicing/actions";

export function PayButton({ id, amount }: { id: string; amount: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    await settleInvoice(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={pay}
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
      {busy ? "Processing…" : `Pay ${amount}`}
    </button>
  );
}
