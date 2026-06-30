"use client";

import { useMemo, useState } from "react";
import { Search, Check, UserPlus, X } from "lucide-react";
import type { ConsignorSummary } from "@/lib/consignments";

const input =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white dark:focus:ring-white";
const label = "mb-1 block text-sm font-medium";

/**
 * Lets the user look up an existing consignor before creating a new one.
 * - Selecting a match submits `consignor_id` (no re-entry of details).
 * - Creating new submits `consignor_name/email/phone/address`; the server
 *   action also de-dupes by email/phone as a safety net.
 */
export function ConsignorPicker({
  consignors,
}: {
  consignors: ConsignorSummary[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ConsignorSummary | null>(null);
  const [creating, setCreating] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return consignors
      .filter((c) =>
        [c.full_name, c.email, c.phone]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [query, consignors]);

  // ----- A consignor is selected from the database -----
  if (selected) {
    return (
      <div>
        <input type="hidden" name="consignor_id" value={selected.id} />
        <div className="flex items-center justify-between rounded-xl border border-green-300 bg-green-50 p-3 dark:border-green-700/50 dark:bg-green-950/40">
          <div className="flex items-center gap-2.5">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            <div className="text-sm">
              <p className="font-medium">{selected.full_name}</p>
              <p className="text-xs text-neutral-500">
                {[selected.email, selected.phone].filter(Boolean).join(" · ") ||
                  "Existing consignor"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded-lg p-1 text-neutral-400 hover:bg-white hover:text-neutral-700 dark:hover:bg-neutral-800"
            aria-label="Change consignor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Existing consignor — their details are already on file.
        </p>
      </div>
    );
  }

  // ----- Creating a new consignor -----
  if (creating) {
    return (
      <div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Full name *</label>
            <input
              name="consignor_name"
              className={input}
              defaultValue={query.trim()}
              required
              autoFocus
            />
          </div>
          <div>
            <label className={label}>Email</label>
            <input name="consignor_email" type="email" className={input} />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input name="consignor_phone" className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Address</label>
            <input name="consignor_address" className={input} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreating(false)}
          className="mt-3 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Search existing consignors instead
        </button>
      </div>
    );
  }

  // ----- Search mode -----
  return (
    <div>
      <label className={label}>Search consignor</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${input} pl-9`}
          placeholder="Search by name, email, or phone…"
          autoComplete="off"
        />
      </div>

      {query.trim() && (
        <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c)}
              className="flex w-full items-center justify-between border-b border-neutral-100 px-3 py-2.5 text-left text-sm transition last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            >
              <span>
                <span className="font-medium">{c.full_name}</span>
                {(c.email || c.phone) && (
                  <span className="ml-2 text-xs text-neutral-500">
                    {[c.email, c.phone].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span className="text-xs text-neutral-400">Select</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-2 bg-neutral-50 px-3 py-2.5 text-left text-sm font-medium text-blue-600 transition hover:bg-neutral-100 dark:bg-neutral-900 dark:text-blue-400 dark:hover:bg-neutral-800"
          >
            <UserPlus className="h-4 w-4" />
            {matches.length === 0
              ? `No match — create “${query.trim()}”`
              : "Not listed — create new consignor"}
          </button>
        </div>
      )}

      {!query.trim() && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <UserPlus className="h-4 w-4" />
          New consignor
        </button>
      )}
    </div>
  );
}
