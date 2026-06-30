"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, MapPin } from "lucide-react";
import { createSaleEvent, setSaleEventStatus } from "@/app/(app)/settings/actions";

export interface SaleEvent {
  id: string;
  name: string;
  sale_date: string | null;
  location: string | null;
  status: string;
}

const control =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export function SaleEventsAdmin({ events }: { events: SaleEvent[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createSaleEvent(name, date, location);
    setBusy(false);
    if (res?.error) return setError(res.error);
    setName("");
    setDate("");
    setLocation("");
    router.refresh();
  }

  async function toggle(ev: SaleEvent) {
    await setSaleEventStatus(ev.id, ev.status === "closed" ? "upcoming" : "closed");
    router.refresh();
  }

  return (
    <div>
      <form
        onSubmit={add}
        className="mb-4 flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Sale name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter Fine Art Sale" className={`${control} w-full`} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={control} />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main Saleroom" className={`${control} w-full`} />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add sale
        </button>
      </form>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No sale events yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 font-medium">Sale</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td className="px-4 py-3 font-medium">{ev.name}</td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {ev.sale_date ? new Date(ev.sale_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                      {ev.location || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        ev.status === "closed"
                          ? "bg-neutral-200 text-neutral-500 dark:bg-neutral-800"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                      }`}
                    >
                      {ev.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggle(ev)} className="text-xs font-medium text-neutral-600 hover:underline dark:text-neutral-300">
                      {ev.status === "closed" ? "Reopen" : "Close"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
