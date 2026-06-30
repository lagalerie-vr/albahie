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
import {
  STATUS_META,
  appraisalUrgency,
  daysUntil,
  formatDate,
  type ConsignmentStatus,
} from "@/lib/consignments";

export interface ConsignmentListItem {
  id: string;
  reference: string;
  title: string;
  category: string | null;
  status: ConsignmentStatus;
  received_at: string;
  appraisal_due_at: string | null;
  responsible_manager: string | null;
  photo_url: string | null;
  consignment: {
    reference: string;
    consignor: { full_name: string } | null;
  } | null;
}

const control =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white dark:focus:ring-white";

/** Local YYYY-MM-DD for a timestamp (for same-day comparison). */
function localDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ConsignmentsTable({ rows }: { rows: ConsignmentListItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ConsignmentStatus>("all");
  const [category, setCategory] = useState<string>("all");
  const [day, setDay] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("table");

  // Only offer filters that actually exist in the data.
  const presentStatuses = useMemo(
    () => Array.from(new Set(rows.map((r) => r.status))),
    [rows],
  );
  const presentCategories = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.category).filter((c): c is string => !!c)),
      ).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (category !== "all" && r.category !== category) return false;
      if (day && localDay(r.received_at) !== day) return false;
      if (q) {
        const haystack = [
          r.reference,
          r.title,
          r.category,
          r.consignment?.consignor?.full_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, status, category]);

  const hasFilters =
    query.trim() || status !== "all" || category !== "all" || day;

  return (
    <div>
      {/* Search + filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference, item, or consignor…"
            className={`${control} w-full pl-9`}
            autoComplete="off"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "all" | ConsignmentStatus)}
          className={control}
        >
          <option value="all">All statuses</option>
          {presentStatuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>

        {presentCategories.length > 0 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={control}
          >
            <option value="all">All categories</option>
            {presentCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            title="Filter by date received"
            className={`${control} pl-9`}
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              setQuery("");
              setStatus("all");
              setCategory("all");
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
        {filtered.length} of {rows.length} item{rows.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No items match your filters.
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ItemCard key={r.id} item={r} onSelect={setSelectedId} />
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
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Appraisal due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="cursor-pointer transition hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                      {r.reference}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.title}</div>
                    {r.category && (
                      <div className="text-xs text-neutral-500">{r.category}</div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-neutral-600 dark:text-neutral-400 sm:table-cell">
                    {r.consignment?.consignor?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <AppraisalCell status={r.status} due={r.appraisal_due_at} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <ItemDrawer itemId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function ItemCard({
  item,
  onSelect,
}: {
  item: ConsignmentListItem;
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
          {item.consignment?.consignor?.full_name ?? "—"}
          {item.category ? ` · ${item.category}` : ""}
        </p>
        <div className="mt-2">
          <AppraisalCell status={item.status} due={item.appraisal_due_at} />
        </div>
      </div>
    </button>
  );
}

function AppraisalCell({
  status,
  due,
}: {
  status: ConsignmentStatus;
  due: string | null;
}) {
  const urgency = appraisalUrgency(status, due);
  if (urgency === null) return <span className="text-neutral-400">—</span>;
  const d = daysUntil(due);
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
        : "text-neutral-600 dark:text-neutral-400";
  return (
    <div>
      <div className={`text-xs font-medium ${cls}`}>{text}</div>
      <div className="text-xs text-neutral-400">{formatDate(due)}</div>
    </div>
  );
}
