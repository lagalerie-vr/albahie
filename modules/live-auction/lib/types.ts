import type { LotStatus } from "../engine/types";

export interface Auction {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "live" | "ended";
  starts_at: string | null;
  increments: { upToCents: number | null; stepCents: number }[];
  soft_close_seconds: number;
  video_room: string | null;
  created_at: string;
}

export interface Lot {
  id: string;
  auction_id: string;
  lot_no: number;
  title: string;
  description: string | null;
  images: string[];
  low_estimate_cents: number | null;
  high_estimate_cents: number | null;
  reserve_cents: number | null;
  start_price_cents: number;
  status: LotStatus;
  current_price_cents: number | null;
  high_bidder_paddle: number | null;
  winning_amount_cents: number | null;
  sort_order: number;
  source_ref: string | null;
}

export interface Registration {
  id: string;
  auction_id: string;
  user_id: string | null;
  client_id: string | null;
  paddle_no: number;
  status: "pending" | "approved" | "suspended";
}

/** A Client (consignor) — the pool auction participants are drawn from. */
export interface Client {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

export interface AbsenteeBid {
  id: string;
  lot_id: string;
  registration_id: string;
  max_amount_cents: number;
}

export interface BidAuditRow {
  id: string;
  server_seq: number;
  lot_id: string;
  paddle_no: number | null;
  channel: string;
  requested_amount_cents: number | null;
  resulting_price_cents: number | null;
  status: "accepted" | "rejected";
  reason: string | null;
  created_at: string;
}

const fmt = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return fmt.format(cents / 100);
}

export function dollarsToCents(input: string): number | null {
  const n = Number(input.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
