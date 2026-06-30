"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Gavel, Loader2 } from "lucide-react";
import { auctionDb } from "../lib/client";
import { formatCents, dollarsToCents, type Lot } from "../lib/types";
import { useAuctionSocket } from "./useAuctionSocket";
import { useCountdown } from "./useCountdown";

// LiveKit is heavy — load it only on the live page, after first paint.
const VideoPlayer = dynamic(
  () => import("./VideoPlayer").then((m) => m.VideoPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-neutral-900 text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ),
  },
);

export function BidderView({
  auctionId,
  auctionTitle,
}: {
  auctionId: string;
  auctionTitle: string;
}) {
  const [lot, setLot] = useState<Lot | null>(null);

  // Follow the lot the auctioneer is currently running.
  useEffect(() => {
    let active = true;
    const poll = async () => {
      const { data } = await auctionDb()
        .from("lots")
        .select("*")
        .eq("auction_id", auctionId)
        .order("sort_order", { ascending: true });
      if (!active || !data) return;
      const lots = data as Lot[];
      const live =
        lots.find((l) => l.status === "open" || l.status === "fair_warning") ??
        lots.find((l) => l.status === "pending") ??
        lots[0] ??
        null;
      setLot((prev) => (prev?.id === live?.id ? { ...live! } : live));
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [auctionId]);

  const { snapshot, user, connected, lastResult, placeBid } = useAuctionSocket(
    lot?.id ?? null,
  );

  const remaining = useCountdown(snapshot?.endsAt ?? null);
  const isLive = snapshot?.status === "open" || snapshot?.status === "fair_warning";
  const isHigh =
    user?.paddleNo != null && snapshot?.highBidderPaddle === user.paddleNo;
  const canBid = connected && !!user?.registered && isLive && !isHigh;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <VideoPlayer auctionId={auctionId} />
        {lot && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              {auctionTitle} · Lot {lot.lot_no}
            </p>
            <h1 className="text-xl font-semibold">{lot.title}</h1>
            {lot.description && (
              <p className="mt-1 text-sm text-neutral-500">{lot.description}</p>
            )}
            <p className="mt-1 text-sm text-neutral-500">
              Estimate {formatCents(lot.low_estimate_cents)} –{" "}
              {formatCents(lot.high_estimate_cents)}
            </p>
          </div>
        )}
      </div>

      {/* Bid panel */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3 flex items-center justify-between">
            <StatusPill status={snapshot?.status} connected={connected} />
            {isLive && remaining != null && (
              <span
                className={`text-sm font-semibold tabular-nums ${
                  remaining <= 5 ? "text-red-600 dark:text-red-400" : "text-neutral-500"
                }`}
              >
                {remaining}s
              </span>
            )}
          </div>

          <p className="text-sm text-neutral-500">Current bid</p>
          <p className="text-3xl font-semibold tabular-nums">
            {formatCents(snapshot?.currentPriceCents ?? null)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {snapshot?.highBidderPaddle != null
              ? `High bidder: paddle ${snapshot.highBidderPaddle}${isHigh ? " (you)" : ""}`
              : "No bids yet"}
            {snapshot && !snapshot.reserveMet && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                · reserve not met
              </span>
            )}
          </p>

          <button
            onClick={() => placeBid()}
            disabled={!canBid}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <Gavel className="h-5 w-5" />
            {isHigh
              ? "You are the high bidder"
              : `Bid ${formatCents(snapshot?.askingPriceCents ?? null)}`}
          </button>

          {lastResult && !lastResult.accepted && (
            <p className="mt-2 text-center text-xs text-red-600 dark:text-red-400">
              Bid rejected: {lastResult.reason}
            </p>
          )}

          <PaddleStatus
            registered={user?.registered ?? false}
            paddleNo={user?.paddleNo ?? null}
            auctionId={auctionId}
          />
        </div>

        {user?.registered && lot && (
          <AbsenteePanel auctionId={auctionId} lotId={lot.id} />
        )}
      </div>
    </div>
  );
}

function StatusPill({
  status,
  connected,
}: {
  status?: string;
  connected: boolean;
}) {
  if (!connected)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
        <Loader2 className="h-3 w-3 animate-spin" /> connecting
      </span>
    );
  const map: Record<string, string> = {
    open: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    fair_warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    sold: "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900",
    passed: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
    pending: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
  };
  const label: Record<string, string> = {
    open: "Open",
    fair_warning: "Fair warning",
    sold: "Sold",
    passed: "Passed",
    pending: "Not started",
  };
  const s = status ?? "pending";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[s] ?? ""}`}>
      {label[s] ?? s}
    </span>
  );
}

function PaddleStatus({
  registered,
  paddleNo,
  auctionId,
}: {
  registered: boolean;
  paddleNo: number | null;
  auctionId: string;
}) {
  const [busy, setBusy] = useState(false);
  if (registered) {
    return (
      <p className="mt-3 text-center text-xs text-neutral-500">
        Paddle #{paddleNo} · registered
      </p>
    );
  }
  async function register() {
    setBusy(true);
    const {
      data: { user },
    } = await (await import("@/lib/supabase/client")).createClient().auth.getUser();
    if (user) {
      await auctionDb()
        .from("registrations")
        .insert({ auction_id: auctionId, user_id: user.id });
    }
    window.location.reload();
  }
  return (
    <div className="mt-3 text-center">
      <button
        onClick={register}
        disabled={busy}
        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {busy ? "Registering…" : "Register for a paddle"}
      </button>
      <p className="mt-1 text-xs text-neutral-400">
        Registration needs clerk approval before you can bid.
      </p>
    </div>
  );
}

function AbsenteePanel({ auctionId, lotId }: { auctionId: string; lotId: string }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  async function save() {
    const cents = dollarsToCents(value);
    if (!cents) return;
    const {
      data: { user },
    } = await (await import("@/lib/supabase/client")).createClient().auth.getUser();
    if (!user) return;
    const { data: reg } = await auctionDb()
      .from("registrations")
      .select("id")
      .eq("auction_id", auctionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!reg) return;
    await auctionDb()
      .from("absentee_bids")
      .upsert(
        { lot_id: lotId, registration_id: reg.id, max_amount_cents: cents },
        { onConflict: "lot_id,registration_id" },
      );
    setSaved(formatCents(cents));
    setValue("");
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-sm font-semibold">Absentee (max) bid</h3>
      <p className="mt-1 text-xs text-neutral-500">
        The engine bids on your behalf up to this max, by increments. Applied
        when the lot (re)opens.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="$ max"
          inputMode="decimal"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          onClick={save}
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Set
        </button>
      </div>
      {saved && (
        <p className="mt-2 text-xs text-green-600 dark:text-green-400">
          Max set to {saved}
        </p>
      )}
    </div>
  );
}
