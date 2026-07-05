"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { updateLocation } from "@/app/(app)/inventory/actions";
import { LOCATIONS } from "@/lib/consignments";

const input =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-1 focus:ring-brand-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-brand-400 dark:focus:ring-brand-400";

export function LocationControl({
  itemId,
  current,
}: {
  itemId: string;
  current: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [location, setLocation] = useState(current);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isCustom = location === "__custom__";

  function save() {
    setError(null);
    const target = isCustom ? custom.trim() : location;
    startTransition(async () => {
      const res = await updateLocation(itemId, target, note);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      setNote("");
      setCustom("");
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4 text-neutral-400" />
          {current}
        </span>
        <button
          onClick={() => {
            setLocation(current);
            setEditing(true);
          }}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Move
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <select
        value={LOCATIONS.includes(location as (typeof LOCATIONS)[number]) ? location : "__custom__"}
        onChange={(e) => setLocation(e.target.value)}
        className={input}
      >
        {LOCATIONS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
        <option value="__custom__">Other…</option>
      </select>

      {isCustom && (
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Custom location (e.g. Shelf D-14)"
          className={input}
        />
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note…"
        className={input}
      />

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {pending ? "Saving…" : "Save location"}
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={pending}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
