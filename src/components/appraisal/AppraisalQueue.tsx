"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Search, X, ImageOff } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewToggle, type ViewMode } from "@/components/ViewToggle";

const ItemDrawer = dynamic(
  () => import("@/components/consignments/ItemDrawer").then((m) => m.ItemDrawer),
  { ssr: false },
);
import {
  appraisalUrgency,
  daysUntil,
  formatDate,
  type ConsignmentStatus,
} from "@/lib/consignments";

export interface QueueItem {
  id: string;
  reference: string;
  title: string;
  category: string | null;
  status: ConsignmentStatus;
  appraisal_due_at: string | null;
  extension_count: number;
  photo_url: string | null;
  consignment: { consignor: { full_name: string } | null } | null;
  manager: { full_name: string | null; email: string } | null;
}

type Urgency = "all" | "overdue" | "soon" | "ok";

const control =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-1 focus:ring-brand-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-brand-400 dark:focus:ring-brand-400";

export function AppraisalQueue({ items }: { items: QueueItem[] }) {
  const [query, setQuery] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("all");
  const [extendedOnly, setExtendedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("cards");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      const u = appraisalUrgency(i.status, i.appraisal_due_at);
      if (urgency !== "all" && u !== urgency) return false;
      if (extendedOnly && i.status !== "extended_review") return false;
      if (q) {
        const hay = [
          i.reference,
          i.title,
          i.category,
          i.consignment?.consignor?.full_name,
          i.manager?.full_name,
          i.manager?.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, urgency, extendedOnly]);

  const hasFilters = query.trim() || urgency !== "all" || extendedOnly;

  return (
    <div>
      {/* Search + filters + view toggle */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference, item, consignor, or manager…"
            className={`${control} w-full pl-9`}
            autoComplete="off"
          />
        </div>
        <select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value as Urgency)}
          className={control}
        >
          <option value="all">All due dates</option>
          <option value="overdue">Overdue</option>
          <option value="soon">Due soon</option>
          <option value="ok">Upcoming</option>
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <input
            type="checkbox"
            checked={extendedOnly}
            onChange={(e) => setExtendedOnly(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          Extended
        </label>
        {hasFilters && (
          <button
            onClick={() => {
              setQuery("");
              setUrgency("all");
              setExtendedOnly(false);
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
        {filtered.length} of {items.length} item{items.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No items match your filters.
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <QueueCard key={item.id} item={item} onSelect={setSelectedId} />
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
                  Consignor
                </th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Manager
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className="cursor-pointer transition hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                      {item.reference}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.title}</div>
                    {item.extension_count > 0 && (
                      <div className="text-xs text-neutral-500">
                        Extended ×{item.extension_count}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-600 dark:text-neutral-400 sm:table-cell">
                    {item.consignment?.consignor?.full_name ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-600 dark:text-neutral-400 md:table-cell">
                    {item.manager?.full_name || item.manager?.email || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3">
                    <DueCell item={item} />
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

function QueueCard({
  item,
  onSelect,
}: {
  item: QueueItem;
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
        <p className="font-mono text-xs text-neutral-500">
          {item.reference}
          {item.extension_count > 0 ? ` · Extended ×${item.extension_count}` : ""}
        </p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {item.consignment?.consignor?.full_name ?? "—"}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <DueCell item={item} />
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            Review →
          </span>
        </div>
      </div>
    </button>
  );
}

function DueCell({ item }: { item: QueueItem }) {
  const d = daysUntil(item.appraisal_due_at);
  const urgency = appraisalUrgency(item.status, item.appraisal_due_at);
  const text =
    d === null
      ? "—"
      : d < 0
        ? `${Math.abs(d)}d overdue`
        : d === 0
          ? "Due today"
          : `${d}d left`;
  const cls =
    urgency === "overdue"
      ? "text-red-600 dark:text-red-400"
      : urgency === "soon"
        ? "text-amber-600 dark:text-amber-400"
        : "text-neutral-500";
  return (
    <div>
      <div className={`text-xs font-medium ${cls}`}>{text}</div>
      <div className="text-xs text-neutral-400">
        due {formatDate(item.appraisal_due_at)}
      </div>
    </div>
  );
}
