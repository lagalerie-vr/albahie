"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, CalendarPlus, Gavel, Handshake, Boxes } from "lucide-react";
import {
  acceptItem,
  rejectItem,
  extendItem,
  createAuctionEvent,
  type RoutingTrack,
} from "@/app/(app)/appraisal/actions";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/consignments";

type Mode = null | "accept" | "reject" | "extend";

interface AuctionOption {
  id: string;
  name: string;
  sale_date: string | null;
}

const input =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-600 focus:ring-1 focus:ring-brand-600 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-brand-400 dark:focus:ring-brand-400";
const label = "mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400";

function parseNum(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function AppraisalDecision({
  itemId,
  currentDueAt,
  onDone,
}: {
  itemId: string;
  currentDueAt: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [weeks, setWeeks] = useState(1);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Accept / routing state
  const [track, setTrack] = useState<RoutingTrack>("auction");
  const [auctions, setAuctions] = useState<AuctionOption[]>([]);
  const [auctionId, setAuctionId] = useState("");
  const [commission, setCommission] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [privateMonths, setPrivateMonths] = useState("12");
  const [showNewAuction, setShowNewAuction] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");

  const loadAuctions = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("auctions")
      .select("id, name, sale_date")
      .eq("status", "upcoming")
      .order("sale_date", { ascending: true });
    setAuctions((data as AuctionOption[]) ?? []);
  }, []);

  useEffect(() => {
    if (mode === "accept") loadAuctions();
  }, [mode, loadAuctions]);

  function reset() {
    setMode(null);
    setNote("");
    setReason("");
    setWeeks(1);
    setError(null);
    setShowNewAuction(false);
    setNewName("");
    setNewDate("");
  }

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) {
        setError(res.error);
        return;
      }
      reset();
      router.refresh();
      onDone?.();
    });
  }

  function confirmAccept() {
    run(() =>
      acceptItem(itemId, {
        track,
        auctionId: track === "auction" ? auctionId || null : null,
        commission: parseNum(commission),
        reservePrice: parseNum(reservePrice),
        askingPrice: parseNum(askingPrice),
        privateMonths: track === "private" ? parseNum(privateMonths) : null,
        note,
      }),
    );
  }

  async function handleCreateAuction() {
    setError(null);
    const res = await createAuctionEvent(newName, newDate);
    if (res.error) {
      setError(res.error);
      return;
    }
    await loadAuctions();
    if (res.id) setAuctionId(res.id);
    setShowNewAuction(false);
    setNewName("");
    setNewDate("");
  }

  // Preview the next forced date when extending.
  const base = Math.max(
    Date.now(),
    currentDueAt ? new Date(currentDueAt).getTime() : Date.now(),
  );
  const previewDue = new Date(
    base + weeks * 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  if (mode === null) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMode("accept")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700"
        >
          <Check className="h-4 w-4" />
          Accept
        </button>
        <button
          onClick={() => setMode("extend")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
        >
          <CalendarPlus className="h-4 w-4" />
          Extend
        </button>
        <button
          onClick={() => setMode("reject")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          <X className="h-4 w-4" />
          Reject
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
      {mode === "accept" && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Routing track
          </p>

          {/* Routing cards */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <TrackCard
              active={track === "inventory"}
              onClick={() => setTrack("inventory")}
              icon={<Boxes className="h-4 w-4" />}
              title="Inventory"
              subtitle="Hold, no sale yet"
            />
            <TrackCard
              active={track === "auction"}
              onClick={() => setTrack("auction")}
              icon={<Gavel className="h-4 w-4" />}
              title="Auction"
              subtitle="Public sale"
            />
            <TrackCard
              active={track === "private"}
              onClick={() => setTrack("private")}
              icon={<Handshake className="h-4 w-4" />}
              title="Private Sale"
              subtitle="Direct brokerage"
            />
          </div>

          {track === "auction" && (
            <div className="space-y-3">
              <div>
                <label className={label}>Assign to auction event</label>
                <select
                  value={auctionId}
                  onChange={(e) => setAuctionId(e.target.value)}
                  className={input}
                >
                  <option value="">— Select an upcoming auction —</option>
                  {auctions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.sale_date ? ` · ${formatDate(a.sale_date)}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewAuction((v) => !v)}
                  className="mt-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {showNewAuction ? "Cancel" : "+ New auction event"}
                </button>
                {showNewAuction && (
                  <div className="mt-2 space-y-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-700">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Auction name"
                      className={input}
                    />
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className={input}
                    />
                    <button
                      type="button"
                      onClick={handleCreateAuction}
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
                    >
                      Create event
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Seller commission (%)</label>
                  <input
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    type="number"
                    min="0"
                    step="0.1"
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Reserve price ($)</label>
                  <input
                    value={reservePrice}
                    onChange={(e) => setReservePrice(e.target.value)}
                    type="number"
                    min="0"
                    placeholder="Optional"
                    className={input}
                  />
                </div>
              </div>
            </div>
          )}

          {track === "private" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Seller commission (%)</label>
                <input
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  type="number"
                  min="0"
                  step="0.1"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Asking price ($)</label>
                <input
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value)}
                  type="number"
                  min="0"
                  placeholder="Optional"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Private sale period (months)</label>
                <input
                  value={privateMonths}
                  onChange={(e) => setPrivateMonths(e.target.value)}
                  type="number"
                  min="1"
                  max="12"
                  className={input}
                />
              </div>
            </div>
          )}

          {track === "inventory" && (
            <p className="text-xs text-neutral-500">
              The item is accepted and stays in inventory. You can route it to a
              sale later.
            </p>
          )}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Optional note…"
            className={input}
          />

          <Actions
            pending={pending}
            onCancel={reset}
            onConfirm={confirmAccept}
            confirmLabel={
              track === "inventory" ? "Accept" : "Generate Agreement & Accept"
            }
            confirmClass="bg-green-600 hover:bg-green-700"
          />
        </div>
      )}

      {mode === "extend" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Extend the review window
          </p>
          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-600 dark:text-neutral-400">
              Add
            </label>
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className={`${input} w-auto`}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  {w} week{w > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Optional reason for the extension…"
            className={input}
          />
          <p className="text-xs text-neutral-500">
            New review date:{" "}
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {formatDate(previewDue)}
            </span>
          </p>
          <Actions
            pending={pending}
            onCancel={reset}
            onConfirm={() => run(() => extendItem(itemId, weeks, note))}
            confirmLabel="Confirm extension"
            confirmClass="bg-amber-500 hover:bg-amber-600"
          />
        </div>
      )}

      {mode === "reject" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Reject &amp; return to consignor
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason for rejection (required)…"
            className={input}
            required
          />
          <Actions
            pending={pending}
            onCancel={reset}
            onConfirm={() => run(() => rejectItem(itemId, reason))}
            confirmLabel="Confirm rejection"
            confirmClass="bg-red-600 hover:bg-red-700"
          />
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

function TrackCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${
        active
          ? "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-950/30"
          : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900"
      }`}
    >
      <span className="mb-1 flex items-center gap-1.5 font-semibold">
        {icon}
        {title}
      </span>
      <span className="text-xs text-neutral-500">{subtitle}</span>
    </button>
  );
}

function Actions({
  pending,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmClass,
}: {
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmClass: string;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onConfirm}
        disabled={pending}
        className={`rounded-lg px-3 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${confirmClass}`}
      >
        {pending ? "Saving…" : confirmLabel}
      </button>
      <button
        onClick={onCancel}
        disabled={pending}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        Cancel
      </button>
    </div>
  );
}
