"use client";

import { useEffect, useState } from "react";
import { auctionDb, hostBrowser } from "../lib/client";
import { formatCents, type Lot } from "../lib/types";
import { useAuctionSocket } from "./useAuctionSocket";
import { useCountdown } from "./useCountdown";

/**
 * Full-screen sale display for a projector/large screen behind the auctioneer.
 * Shows the current lot's photo and live bidding info. Read-only — it follows
 * whatever lot the auctioneer is running and updates in real time.
 */
export function PresentationScreen({
  auctionId,
  auctionTitle,
}: {
  auctionId: string;
  auctionTitle: string;
}) {
  const [lot, setLot] = useState<Lot | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

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
      const current =
        lots.find((l) => l.status === "open" || l.status === "fair_warning") ??
        lots.find((l) => l.status === "pending") ??
        lots[0] ??
        null;
      setLot((prev) => (prev?.id === current?.id ? prev : current));
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [auctionId]);

  // Resolve the lot's photo from the host item (lot.source_ref = item id).
  useEffect(() => {
    let active = true;
    setImageUrl(null);
    const ref = lot?.source_ref;
    if (!ref) return;
    (async () => {
      const sb = hostBrowser();
      const { data } = await sb
        .from("consignment_item_photos")
        .select("storage_path, is_primary")
        .eq("item_id", ref);
      const photos = (data as { storage_path: string; is_primary: boolean }[]) ?? [];
      const chosen = photos.find((p) => p.is_primary) ?? photos[0];
      if (!active) return;
      setImageUrl(
        chosen
          ? sb.storage.from("consignment-photos").getPublicUrl(chosen.storage_path).data.publicUrl
          : null,
      );
    })();
    return () => {
      active = false;
    };
  }, [lot?.id, lot?.source_ref]);

  const { snapshot } = useAuctionSocket(lot?.id ?? null);
  const remaining = useCountdown(snapshot?.endsAt ?? null);
  const status = snapshot?.status ?? lot?.status ?? "pending";
  const live = status === "open" || status === "fair_warning";
  const priceLabel =
    status === "sold" ? "Sold for" : live ? "Current bid" : "Opening at";
  const price =
    snapshot?.currentPriceCents != null
      ? snapshot.currentPriceCents
      : lot?.start_price_cents ?? null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-12 py-6">
        <span className="text-2xl font-medium tracking-tight text-neutral-400">
          {auctionTitle}
        </span>
        <StatusTag status={status} />
      </div>

      <div className="grid flex-1 grid-cols-2 gap-10 px-12 pb-10">
        {/* Lot photo */}
        <div className="flex items-center justify-center overflow-hidden rounded-3xl bg-neutral-900">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-2xl text-neutral-700">No image</span>
          )}
        </div>

        {/* Lot + bid info */}
        <div className="flex flex-col justify-center">
          {lot ? (
            <>
              <p className="text-3xl text-neutral-400">Lot {lot.lot_no}</p>
              <h1 className="mt-2 text-6xl font-semibold leading-[1.05]">{lot.title}</h1>
              {(lot.low_estimate_cents != null || lot.high_estimate_cents != null) && (
                <p className="mt-4 text-3xl text-neutral-400">
                  Estimate {formatCents(lot.low_estimate_cents)} –{" "}
                  {formatCents(lot.high_estimate_cents)}
                </p>
              )}

              <div className="mt-12">
                <p className="text-2xl uppercase tracking-[0.15em] text-neutral-500">
                  {priceLabel}
                </p>
                <p className="mt-2 text-[9rem] font-bold leading-none tabular-nums">
                  {formatCents(price)}
                </p>
                <div className="mt-4 flex items-baseline gap-6">
                  <p className="text-4xl text-neutral-200">
                    {snapshot?.highBidderPaddle != null
                      ? `Paddle #${snapshot.highBidderPaddle}`
                      : live
                        ? "Awaiting bids"
                        : ""}
                  </p>
                  {snapshot && !snapshot.reserveMet && status !== "sold" && (
                    <span className="rounded-full bg-amber-500/15 px-4 py-1 text-2xl font-medium text-amber-400">
                      reserve not met
                    </span>
                  )}
                </div>
              </div>

              {live && remaining != null && (
                <p
                  className={`mt-10 text-5xl font-bold tabular-nums ${
                    remaining <= 5 ? "text-red-500" : "text-neutral-500"
                  }`}
                >
                  {remaining}s
                </p>
              )}
            </>
          ) : (
            <p className="text-4xl text-neutral-600">Waiting for the next lot…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: "Bidding open", cls: "bg-green-500/15 text-green-400" },
    fair_warning: { label: "Fair warning", cls: "bg-amber-500/15 text-amber-400" },
    sold: { label: "Sold", cls: "bg-white text-black" },
    passed: { label: "Passed", cls: "bg-neutral-700 text-neutral-300" },
    pending: { label: "Next lot", cls: "bg-neutral-800 text-neutral-400" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`rounded-full px-6 py-2 text-2xl font-semibold ${s.cls}`}>
      {status === "open" && (
        <span className="mr-3 inline-block h-3 w-3 animate-pulse rounded-full bg-green-400 align-middle" />
      )}
      {s.label}
    </span>
  );
}
