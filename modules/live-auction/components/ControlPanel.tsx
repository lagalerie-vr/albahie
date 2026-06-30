"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Play,
  Square,
  Radio,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertTriangle,
  MonitorPlay,
} from "lucide-react";
import { auctionDb } from "../lib/client";
import { AuctioneerConsole } from "./AuctioneerConsole";

const VideoPlayer = dynamic(
  () => import("./VideoPlayer").then((m) => m.VideoPlayer),
  { ssr: false },
);

interface Ingest {
  whipUrl: string;
  streamKey: string;
  configured: boolean;
  error?: string;
}

export function ControlPanel({
  auctionId,
  auctionTitle,
  initialStatus,
}: {
  auctionId: string;
  auctionTitle: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [ingest, setIngest] = useState<Ingest | null>(null);
  const [loadingObs, setLoadingObs] = useState(false);
  const [busy, setBusy] = useState(false);
  const isLive = status === "live";

  async function fetchObs(force = false) {
    setLoadingObs(true);
    try {
      const res = await fetch(
        `/auctions/${auctionId}/ingest${force ? "?force=1" : ""}`,
        { method: "POST" },
      );
      if (res.ok) setIngest(await res.json());
    } finally {
      setLoadingObs(false);
    }
  }

  useEffect(() => {
    fetchObs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  function openAuctionView() {
    window.open(
      `/auctions/${auctionId}/live`,
      "_blank",
      "noopener,noreferrer,width=1100,height=820",
    );
  }

  function openPresentation() {
    window.open(`/auctions/${auctionId}/present`, "auction-screen", "noopener,noreferrer");
  }

  async function start() {
    setBusy(true);
    try {
      await auctionDb().from("auctions").update({ status: "live" }).eq("id", auctionId);
      setStatus("live");
      // The big-screen sale display for behind the auctioneer.
      openPresentation();
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!confirm("Stop the stream and end this auction?")) return;
    setBusy(true);
    try {
      await auctionDb().from("auctions").update({ status: "ended" }).eq("id", auctionId);
      setStatus("ended");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: string) {
    setBusy(true);
    try {
      await auctionDb().from("auctions").update({ status: next }).eq("id", auctionId);
      setStatus(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Stream control */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Radio className="h-5 w-5" /> Stream control
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                isLive
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
              }`}
            >
              {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
              {status}
            </span>
          </div>

          <p className="mb-4 text-sm text-neutral-500">
            Starting opens the <strong>sale screen</strong> in a new window — put it on the
            display behind the auctioneer (lot photo + live bid). The public auction view
            can be opened separately.
          </p>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-neutral-500">
              Status
            </label>
            <select
              value={status}
              disabled={busy}
              onChange={(e) => changeStatus(e.target.value)}
              className="w-full max-w-[12rem] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="ended">Ended</option>
            </select>
          </div>

          {!isLive ? (
            <button
              onClick={start}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              Start stream
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={openPresentation}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900"
              >
                <MonitorPlay className="h-4 w-4" /> Open sale screen
              </button>
              <button
                onClick={openAuctionView}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                <ExternalLink className="h-4 w-4" /> Open auction view
              </button>
              <button
                onClick={stop}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                Stop stream &amp; end
              </button>
            </div>
          )}
        </div>

        {/* OBS connection */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Radio className="h-5 w-5" /> OBS connection
            </h2>
            <button
              onClick={() => fetchObs(true)}
              disabled={loadingObs}
              title="Generate fresh WHIP credentials"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {loadingObs ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regenerate
            </button>
          </div>

          {ingest && !ingest.configured && (
            <div className="mb-3 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {ingest.error ??
                  "Streaming isn’t configured. Add the LiveKit env vars to .env.local and restart the dev server."}
              </div>
            </div>
          )}

          <p className="mb-3 text-sm text-neutral-500">
            In OBS → <strong>Settings → Stream</strong>, set Service to{" "}
            <strong>WHIP</strong> (OBS 30+), then paste:
          </p>
          <CopyField label="WHIP URL (Server)" value={ingest?.whipUrl ?? ""} />
          <CopyField label="Bearer Token (Stream key)" value={ingest?.streamKey ?? ""} secret />
        </div>
      </div>

      {/* Live preview */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Stream preview
        </h2>
        <div className="mx-auto max-w-2xl">
          <VideoPlayer auctionId={auctionId} />
        </div>
      </div>

      {/* Run the sale */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Run the sale
        </h2>
        <AuctioneerConsole auctionId={auctionId} auctionTitle={auctionTitle} />
      </div>
    </div>
  );
}

function CopyField({
  label,
  value,
  secret,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(!secret);

  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const display = !value ? "—" : show ? value : "•".repeat(Math.min(value.length, 40));

  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-neutral-500">{label}</label>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-neutral-100 px-3 py-2 text-xs dark:bg-neutral-800">
          {display}
        </code>
        {secret && value && (
          <button
            onClick={() => setShow((s) => !s)}
            className="rounded-lg border border-neutral-300 px-2 py-2 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
        <button
          onClick={copy}
          disabled={!value}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-2 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
