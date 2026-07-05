"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Search, X, ImageOff, CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewToggle, type ViewMode } from "@/components/ViewToggle";

const ItemDrawer = dynamic(
  () => import("@/components/consignments/ItemDrawer").then((m) => m.ItemDrawer),
  { ssr: false },
);
import { formatDate, type ConsignmentStatus } from "@/lib/consignments";

export interface HistoryItem {
  id: string;
  reference: string;
  title: string;
  category: string | null;
  status: ConsignmentStatus;
  routing_track: string | null;
  appraisal_decided_at: string | null;
  photo_url: string | null;
  consignment: { consignor: { full_name: string } | null } | null;
  decided_by_profile: { full_name: string | null; email: string } | null;
  auction: { name: string } | null;
}

const control =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-1 focus:ring-brand-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-brand-400 dark:focus:ring-brand-400";

/** Local YYYY-MM-DD for a timestamp (for same-day comparison). */
function localDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function routeLabel(item: HistoryItem): string {
  if (item.routing_track === "auction")
    return item.auction ? `Auction · ${item.auction.name}` : "Auction";
  if (item.routing_track === "private") return "Private sale";
  if (item.status === "declined") return "Declined";
  if (item.status === "accepted") return "Held in inventory";
  return "—";
}

export function AppraisalHistory({ items }: { items: HistoryItem[] }) {
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("table");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (day && localDay(i.appraisal_decided_at) !== day) return false;
      if (q) {
        const hay = [
          i.reference,
          i.title,
          i.category,
          i.consignment?.consignor?.full_name,
          routeLabel(i),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, day]);

  const hasFilters = query.trim() || day;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference, item, consignor, or route…"
            className={`${control} w-full pl-9`}
            autoComplete="off"
          />
        </div>
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            title="Filter by decision date"
            className={`${control} pl-9`}
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setQuery("");
              setDay("");
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
        <ViewToggle value={view} onChange={setView} />
      </div>

      <p className="mb-2 text-xs text-neutral-500">
        {filtered.length} of {items.length} appraised
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          {items.length === 0
            ? "No items have been appraised yet."
            : "No items match your filters."}
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => (
            <HistoryCard key={i.id} item={i} onSelect={setSelectedId} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  Outcome
                </th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Route
                </th>
                <th className="px-4 py-3 font-medium">Decided</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => setSelectedId(i.id)}
                  className="cursor-pointer transition hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                      {i.reference}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{i.title}</div>
                    <div className="text-xs text-neutral-500">
                      {i.consignment?.consignor?.full_name ?? "—"}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-600 dark:text-neutral-400 md:table-cell">
                    {routeLabel(i)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">{formatDate(i.appraisal_decided_at)}</div>
                    <div className="text-xs text-neutral-400">
                      {i.decided_by_profile?.full_name ||
                        i.decided_by_profile?.email ||
                        "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <ItemDrawer
          itemId={selectedId}
          onClose={() => setSelectedId(null)}
          context="appraisal"
        />
      )}
    </div>
  );
}

function HistoryCard({
  item,
  onSelect,
}: {
  item: HistoryItem;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(item.id)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
    >
      <div className="aspect-[4/3] w-full bg-neutral-100 dark:bg-neutral-800">
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photo_url}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300 dark:text-neutral-600">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="font-medium leading-tight">{item.title}</h3>
          <StatusBadge status={item.status} />
        </div>
        <p className="font-mono text-xs text-neutral-500">{item.reference}</p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {routeLabel(item)}
        </p>
        <p className="mt-2 text-xs text-neutral-400">
          Decided {formatDate(item.appraisal_decided_at)}
        </p>
      </div>
    </button>
  );
}
