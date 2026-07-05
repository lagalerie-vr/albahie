"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, X } from "lucide-react";

const control =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export function ReportFilters({
  auctions,
  initial,
}: {
  auctions: { id: string; title: string }[];
  initial: { from: string; to: string; auction: string };
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [auction, setAuction] = useState(initial.auction);

  function apply(next?: { from?: string; to?: string; auction?: string }) {
    const f = next?.from ?? from;
    const t = next?.to ?? to;
    const a = next?.auction ?? auction;
    const p = new URLSearchParams();
    if (f) p.set("from", f);
    if (t) p.set("to", t);
    if (a) p.set("auction", a);
    const qs = p.toString();
    router.push(qs ? `/reports?${qs}` : "/reports");
  }

  function preset(days: number) {
    const today = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const f = start.toISOString().slice(0, 10);
    const t = today.toISOString().slice(0, 10);
    setFrom(f);
    setTo(t);
    apply({ from: f, to: t });
  }

  function clear() {
    setFrom("");
    setTo("");
    setAuction("");
    router.push("/reports");
  }

  const active = from || to || auction;

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">From</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={control} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">To</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={control} />
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className="mb-1 block text-xs font-medium text-neutral-500">Auction</label>
        <select value={auction} onChange={(e) => setAuction(e.target.value)} className={`${control} w-full`}>
          <option value="">All auctions</option>
          {auctions.map((a) => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => preset(30)} className="rounded-lg border border-neutral-300 px-2.5 py-2 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">30d</button>
        <button onClick={() => preset(90)} className="rounded-lg border border-neutral-300 px-2.5 py-2 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">90d</button>
        <button onClick={() => preset(365)} className="rounded-lg border border-neutral-300 px-2.5 py-2 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">1y</button>
        <button onClick={() => apply()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-400">
          <Filter className="h-4 w-4" /> Apply
        </button>
        {active && (
          <button onClick={clear} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
