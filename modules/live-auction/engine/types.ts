// Pure bidding-engine types. No I/O here — the engine is deterministic and
// unit-testable; the server owns persistence, timers, and broadcast.

export type LotStatus = "pending" | "open" | "fair_warning" | "sold" | "passed";

export type BidChannel = "online" | "absentee" | "in_room" | "phone";

export interface IncrementRung {
  /** Applies while current price < upToCents; null = top rung. */
  upToCents: number | null;
  stepCents: number;
}

export interface AbsenteeProxy {
  registrationId: string;
  paddleNo: number;
  maxAmountCents: number;
  /** Tie-break: earlier proxies win ties. Lower = earlier. */
  seq: number;
}

export interface LotState {
  lotId: string;
  auctionId: string;
  status: LotStatus;
  startPriceCents: number;
  reserveCents: number | null;
  /** null until the first accepted bid. */
  currentPriceCents: number | null;
  highBidderRegistrationId: string | null;
  highBidderPaddle: number | null;
  /** soft-close deadline (epoch ms); null when no clock is running. */
  endsAt: number | null;
}

export interface EngineContext {
  ladder: IncrementRung[];
  /** All absentee proxies currently active on the lot. */
  proxies: AbsenteeProxy[];
  /** Soft-close window length in ms (used when (re)arming the clock). */
  softCloseMs: number;
  now: number;
}

export interface BidInput {
  channel: BidChannel;
  registrationId: string | null;
  paddleNo: number | null;
  /** If omitted, the engine uses the current asking price (one-tap bid). */
  amountCents?: number;
}

export interface BidDecision {
  accepted: boolean;
  reason?: string;
  state: LotState;
  resultingPriceCents?: number;
  /** Registrations that became high bidder via proxy during settlement. */
  proxyApplied: boolean;
}
