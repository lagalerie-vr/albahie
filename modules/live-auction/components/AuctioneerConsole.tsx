"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Play,
  AlarmClock,
  Gavel,
  Ban,
  RefreshCw,
  TimerReset,
  Hand,
  Phone,
  Loader2,
} from "lucide-react";
import { auctionDb } from "../lib/client";
import { formatCents, dollarsToCents, type Lot, type BidAuditRow } from "../lib/types";
import { useAuctionSocket } from "./useAuctionSocket";
import { useCountdown } from "./useCountdown";
import type { ControlAction } from "../server/protocol";
import type { BidChannel } from "../engine/types";

type ControlFn = (
  action: ControlAction,
  extra?: { paddleNo?: number; amountCents?: number; channel?: BidChannel },
) => void;

// Server rejection codes → readable messages for the clerk.
const REASON: Record<string, string> = {
  paddle_required: "Enter a paddle number.",
  unknown_paddle: "No participant has that paddle number in this auction.",
  paddle_not_approved: "That paddle isn’t approved yet (approve it in Catalogue → Participants).",
  lot_not_open: "Open the lot before taking bids.",
  below_asking: "That amount is below the asking price.",
  already_high_bidder: "That paddle is already the high bidder.",
  lot_closed: "The lot has already closed.",
  no_bids: "No bids on this lot to hammer.",
  reserve_not_met: "Reserve not met — the lot can’t be sold yet.",
  cannot_hammer: "Can’t hammer this lot right now.",
  forbidden: "You don’t have permission for that action.",
};

export function AuctioneerConsole({
  auctionId,
  auctionTitle,
}: {
  auctionId: string;
  auctionTitle: string;
}) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audit, setAudit] = useState<BidAuditRow[]>([]);

  const [paddles, setPaddles] = useState<number[]>([]);

  const loadLots = useCallback(async () => {
    const { data } = await auctionDb()
      .from("lots")
      .select("*")
      .eq("auction_id", auctionId)
      .order("sort_order", { ascending: true });
    const rows = (data as Lot[]) ?? [];
    setLots(rows);
    setSelectedId((cur) => cur ?? rows.find((l) => l.status === "open")?.id ?? rows[0]?.id ?? null);
  }, [auctionId]);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  // Approved paddles (for the floor/phone bid reference).
  useEffect(() => {
    auctionDb()
      .from("registrations")
      .select("paddle_no, status")
      .eq("auction_id", auctionId)
      .then(({ data }) => {
        const rows = (data as { paddle_no: number; status: string }[]) ?? [];
        setPaddles(
          rows
            .filter((r) => r.status === "approved")
            .map((r) => r.paddle_no)
            .sort((a, b) => a - b),
        );
      });
  }, [auctionId]);

  const { snapshot, user, connected, control, lastError } = useAuctionSocket(selectedId);
  const remaining = useCountdown(snapshot?.endsAt ?? null);

  // Surface the most recent server rejection (floor bid, hammer, etc.) briefly.
  const [errBanner, setErrBanner] = useState<string | null>(null);
  useEffect(() => {
    if (!lastError) return;
    setErrBanner(REASON[lastError.message] ?? lastError.message);
    const t = setTimeout(() => setErrBanner(null), 6000);
    return () => clearTimeout(t);
  }, [lastError]);

  // Refresh the bid feed + lot list whenever state changes.
  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      const { data } = await auctionDb()
        .from("bid_audit")
        .select("*")
        .eq("lot_id", selectedId)
        .order("server_seq", { ascending: false })
        .limit(25);
      setAudit((data as BidAuditRow[]) ?? []);
    })();
    loadLots();
  }, [selectedId, snapshot?.currentPriceCents, snapshot?.status, loadLots]);

  const isClerk = user?.roles.includes("clerk") || user?.roles.includes("auctioneer");
  const selected = lots.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Lot list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {auctionTitle} · Lots
          </h2>
          <button onClick={loadLots} className="text-neutral-400 hover:text-neutral-700">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {lots.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                l.id === selectedId
                  ? "border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-800"
                  : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              }`}
            >
              <span>
                <span className="font-mono text-xs text-neutral-400">#{l.lot_no}</span>{" "}
                {l.title}
              </span>
              <LotStatusTag status={l.status} />
            </button>
          ))}
          {lots.length === 0 && (
            <p className="text-sm text-neutral-500">No lots. Add them in the catalog.</p>
          )}
        </div>
      </div>

      {/* Console */}
      <div className="space-y-4 lg:col-span-2">
        {!selected ? (
          <p className="text-sm text-neutral-500">Select a lot.</p>
        ) : (
          <>
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">
                    Lot {selected.lot_no} · {connected ? "connected" : "connecting…"}
                  </p>
                  <h1 className="text-lg font-semibold">{selected.title}</h1>
                </div>
                {remaining != null && (
                  <span className={`text-2xl font-bold tabular-nums ${remaining <= 5 ? "text-red-600" : "text-neutral-400"}`}>
                    {remaining}s
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <Metric label="Current" value={formatCents(snapshot?.currentPriceCents ?? null)} />
                <Metric label="Asking" value={formatCents(snapshot?.askingPriceCents ?? null)} />
                <Metric
                  label="High paddle"
                  value={snapshot?.highBidderPaddle != null ? `#${snapshot.highBidderPaddle}` : "—"}
                />
              </div>
              {snapshot && !snapshot.reserveMet && (
                <p className="mt-2 text-center text-xs text-amber-600 dark:text-amber-400">
                  Reserve not met
                </p>
              )}

              {!connected || !user ? (
                <div className="mt-4">
                  <p className="flex items-center gap-2 text-sm text-neutral-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting to the bidding server…
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Make sure it’s running — <code>npm run dev:all</code>. If it
                    still hangs, restart the web dev server so{" "}
                    <code>NEXT_PUBLIC_AUCTION_WS_URL</code> is loaded.
                  </p>
                </div>
              ) : isClerk ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Ctrl onClick={() => control("open")} icon={Play} label="Open" />
                    <Ctrl onClick={() => control("fair_warning")} icon={AlarmClock} label="Fair warning" />
                    <Ctrl onClick={() => control("extend")} icon={TimerReset} label="Extend clock" />
                    <Ctrl onClick={() => control("reload_absentee")} icon={RefreshCw} label="Reload absentee" />
                    <Ctrl onClick={() => control("hammer")} icon={Gavel} label="Hammer / Sold" strong />
                    <Ctrl onClick={() => control("pass")} icon={Ban} label="Pass" />
                  </div>
                  <FloorBidPanel
                    control={control}
                    asking={snapshot?.askingPriceCents ?? null}
                    paddles={paddles}
                    live={
                      snapshot?.status === "open" || snapshot?.status === "fair_warning"
                    }
                  />
                  {errBanner && (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                      {errBanner}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-4 text-sm text-neutral-500">
                  You do not have clerk permissions.
                </p>
              )}
            </div>

            {/* Bid feed */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Bid feed
              </h3>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {audit.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ChannelTag channel={b.channel} />
                      <span className="text-neutral-500">
                        {b.paddle_no != null ? `#${b.paddle_no}` : "—"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">
                        {formatCents(b.resulting_price_cents ?? b.requested_amount_cents)}
                      </span>
                      {b.status === "rejected" ? (
                        <span className="text-xs text-red-500">✗ {b.reason}</span>
                      ) : (
                        <span className="text-xs text-green-600">✓</span>
                      )}
                    </span>
                  </div>
                ))}
                {audit.length === 0 && (
                  <p className="text-sm text-neutral-500">No bids yet.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FloorBidPanel({
  control,
  asking,
  paddles,
  live,
}: {
  control: ControlFn;
  asking: number | null;
  paddles: number[];
  live: boolean;
}) {
  const [paddle, setPaddle] = useState("");
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<BidChannel>("in_room");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = parseInt(paddle.trim(), 10);
    if (!Number.isFinite(p)) return;
    const cents = amount.trim() ? dollarsToCents(amount) ?? undefined : undefined;
    control("floor_bid", { paddleNo: p, amountCents: cents, channel });
    setAmount("");
  }

  const field =
    "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
  const seg = (on: boolean) =>
    `inline-flex items-center gap-1 rounded-md px-2 py-1 transition ${
      on
        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
    }`;

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Floor / phone bid
        </p>
        <div className="flex rounded-lg border border-neutral-300 p-0.5 text-xs dark:border-neutral-700">
          <button type="button" onClick={() => setChannel("in_room")} className={seg(channel === "in_room")}>
            <Hand className="h-3.5 w-3.5" /> Floor
          </button>
          <button type="button" onClick={() => setChannel("phone")} className={seg(channel === "phone")}>
            <Phone className="h-3.5 w-3.5" /> Phone
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={paddle}
          onChange={(e) => setPaddle(e.target.value)}
          placeholder="Paddle #"
          inputMode="numeric"
          className={`${field} w-24`}
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={asking != null ? `Amount — blank bids ${formatCents(asking)}` : "Amount"}
          inputMode="decimal"
          className={`${field} flex-1`}
        />
        <button
          type="submit"
          disabled={!live || !paddle.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Bid
        </button>
      </div>

      {paddles.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-neutral-400">Paddles:</span>
          {paddles.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPaddle(String(p))}
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                paddle === String(p)
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              #{p}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-neutral-400">
          No approved paddles yet — add participants in Catalogue → Participants.
        </p>
      )}
      {!live && (
        <p className="mt-2 text-xs text-neutral-400">Open the lot before taking floor bids.</p>
      )}
    </form>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/50">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Ctrl({
  onClick,
  icon: Icon,
  label,
  strong,
}: {
  onClick: () => void;
  icon: typeof Play;
  label: string;
  strong?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        strong
          ? "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          : "border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function LotStatusTag({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "text-green-600",
    fair_warning: "text-amber-600",
    sold: "text-neutral-900 dark:text-white",
    passed: "text-neutral-400",
    pending: "text-neutral-400",
  };
  return <span className={`text-xs font-medium ${map[status] ?? ""}`}>{status}</span>;
}

function ChannelTag({ channel }: { channel: string }) {
  return (
    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-neutral-500 dark:bg-neutral-800">
      {channel}
    </span>
  );
}
