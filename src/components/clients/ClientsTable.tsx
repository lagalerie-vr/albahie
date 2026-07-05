"use client";

import { useMemo, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, UserPlus, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { createClientRecord, type CreateClientState } from "@/app/(app)/clients/actions";
import { KycBadge } from "@/components/clients/KycBadge";
import type { ClientRow } from "@/lib/clients";

const control =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-1 focus:ring-brand-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-brand-400 dark:focus:ring-brand-400";

type TypeFilter = "all" | "buyers" | "sellers";

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [kyc, setKyc] = useState<"all" | ClientRow["kyc"]>("all");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (type === "buyers" && r.buyer_count === 0) return false;
      if (type === "sellers" && r.sales_count === 0) return false;
      if (kyc !== "all" && r.kyc !== kyc) return false;
      if (q) {
        const hay = [r.full_name, r.email, r.phone].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, type, kyc]);

  const hasFilters = query.trim() || type !== "all" || kyc !== "all";

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, or phone…"
            className={`${control} w-full pl-9`}
            autoComplete="off"
          />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value as TypeFilter)} className={control}>
          <option value="all">Buyers &amp; sellers</option>
          <option value="buyers">Buyers</option>
          <option value="sellers">Sellers</option>
        </select>
        <select value={kyc} onChange={(e) => setKyc(e.target.value as typeof kyc)} className={control}>
          <option value="all">Any KYC</option>
          <option value="verified">KYC verified</option>
          <option value="pending">KYC pending</option>
          <option value="rejected">KYC rejected</option>
          <option value="expired">KYC expired</option>
          <option value="none">No KYC</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              setQuery("");
              setType("all");
              setKyc("all");
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          <UserPlus className="h-4 w-4" /> New client
        </button>
      </div>

      <p className="mb-2 text-xs text-neutral-500">
        {filtered.length} of {rows.length} client{rows.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No clients match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Contact</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Sales</th>
                <th className="px-4 py-3 font-medium">Auctions</th>
                <th className="px-4 py-3 font-medium">KYC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/clients/${r.id}`)}
                  className="cursor-pointer transition hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <td className="px-4 py-3 font-medium">{r.full_name}</td>
                  <td className="hidden px-4 py-3 text-neutral-600 dark:text-neutral-400 sm:table-cell">
                    {r.email || r.phone || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadges sales={r.sales_count} buys={r.buyer_count} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.sales_count}</td>
                  <td className="px-4 py-3 tabular-nums">{r.buyer_count}</td>
                  <td className="px-4 py-3">
                    <KycBadge standing={r.kyc} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && <AddClientModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function TypeBadges({ sales, buys }: { sales: number; buys: number }) {
  if (sales === 0 && buys === 0)
    return <span className="text-xs text-neutral-400">—</span>;
  return (
    <span className="flex gap-1">
      {sales > 0 && (
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          Seller
        </span>
      )}
      {buys > 0 && (
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium uppercase text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          Buyer
        </span>
      )}
    </span>
  );
}

function AddClientModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState<CreateClientState, FormData>(
    createClientRecord,
    null,
  );
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New client</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form action={formAction} className="space-y-3">
          <input name="full_name" placeholder="Full name" required className={`${control} w-full`} autoFocus />
          <input name="email" type="email" placeholder="Email (optional)" className={`${control} w-full`} />
          <input name="phone" placeholder="Phone (optional)" className={`${control} w-full`} />
          <input name="address" placeholder="Address (optional)" className={`${control} w-full`} />
          <textarea name="notes" placeholder="Notes (optional)" rows={2} className={`${control} w-full`} />
          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-brand-500"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create client
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
