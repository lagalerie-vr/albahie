"use client";

import { useActionState, useState } from "react";
import { Gavel, Package } from "lucide-react";
import { createAuction, type CreateState } from "@/app/(app)/catalogue/new/actions";
import { formatCents } from "../lib/types";

export interface InventoryItem {
  id: string;
  reference: string;
  title: string;
  reserve_price: number | null;
  consignor: string | null;
}

const input =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export function AuctionCreator({ items }: { items: InventoryItem[] }) {
  const [state, formAction, pending] = useActionState<CreateState, FormData>(
    createAuction,
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <form action={formAction} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Inventory picker */}
      <div className="lg:col-span-2">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            <Package className="h-4 w-4" />
            Available inventory ({items.length})
          </h2>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
              }
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
            No items available yet. In <strong>Inventory</strong>, open an item and set its
            status to <strong>Routed · Auction</strong> or <strong>Cataloged</strong> (or
            accept it in Appraisal).
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
            {items.map((it) => {
              const checked = selected.has(it.id);
              return (
                <label
                  key={it.id}
                  className={`flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-4 py-3 text-sm last:border-0 transition dark:border-neutral-800 ${
                    checked
                      ? "bg-neutral-50 dark:bg-neutral-900"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="item_ids"
                    value={it.id}
                    checked={checked}
                    onChange={() => toggle(it.id)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  <span className="flex-1">
                    <span className="font-medium">{it.title}</span>
                    <span className="ml-2 font-mono text-xs text-neutral-400">
                      {it.reference}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {it.consignor ?? "—"}
                      {it.reserve_price != null
                        ? ` · reserve ${formatCents(Math.round(it.reserve_price * 100))}`
                        : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Auction details */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Auction details
          </h2>

          <label className="mb-1 block text-xs font-medium text-neutral-500">Title</label>
          <input name="title" className={input} placeholder="e.g. Autumn Fine Art Sale" required />

          <label className="mb-1 mt-3 block text-xs font-medium text-neutral-500">Sale date</label>
          <input name="date" type="datetime-local" className={input} />

          <label className="mb-1 mt-3 block text-xs font-medium text-neutral-500">
            Soft-close (seconds)
          </label>
          <input name="soft_close" type="number" defaultValue={30} min={5} className={input} />

          <p className="mt-3 text-xs text-neutral-500">
            {selected.size} item{selected.size === 1 ? "" : "s"} selected — each becomes
            a lot. You can add or reorder lots afterwards.
          </p>

          {state?.error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            <Gavel className="h-4 w-4" />
            {pending ? "Creating…" : "Create auction"}
          </button>
        </div>
      </div>
    </form>
  );
}
