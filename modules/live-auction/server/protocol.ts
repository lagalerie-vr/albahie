// WebSocket wire protocol — shared by the browser client and the bidding
// server. Pure types only (no Node/DOM imports) so both sides can import it.

import type { BidChannel, LotStatus } from "../engine/types";
import type { AuctionRole } from "../adapters/types";

export type ControlAction =
  | "open"
  | "fair_warning"
  | "extend"
  | "hammer"
  | "pass"
  | "reopen"
  | "reload_absentee"
  | "floor_bid";

export interface LotSnapshot {
  lotId: string;
  auctionId: string;
  status: LotStatus;
  currentPriceCents: number | null;
  askingPriceCents: number;
  highBidderPaddle: number | null;
  reserveMet: boolean;
  /** soft-close deadline (epoch ms) or null. */
  endsAt: number | null;
  /** server clock (epoch ms) so clients can sync the countdown. */
  serverTime: number;
}

// ── client → server ─────────────────────────────────────────────────
export type ClientMessage =
  | { t: "hello"; token: string; lotId: string }
  | { t: "bid"; lotId: string; idempotencyKey: string; amountCents?: number }
  | {
      t: "ctrl";
      lotId: string;
      action: ControlAction;
      // floor/phone bids carry an explicit paddle + (optional) amount + channel
      paddleNo?: number;
      amountCents?: number;
      channel?: BidChannel;
    }
  | { t: "ping" };

// ── server → client ─────────────────────────────────────────────────
export interface ConnectedUser {
  id: string;
  displayName: string;
  roles: AuctionRole[];
  paddleNo: number | null;
  registered: boolean;
}

export type ServerMessage =
  | { t: "welcome"; user: ConnectedUser; lot: LotSnapshot }
  | { t: "state"; lot: LotSnapshot }
  | {
      t: "bid.result";
      idempotencyKey: string;
      accepted: boolean;
      reason?: string;
    }
  | { t: "error"; message: string }
  | { t: "pong" };
