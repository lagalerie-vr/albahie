// ============================================================================
// Host integration boundary. The live-auction module talks to the host
// platform ONLY through these interfaces. Ship a mock impl (runs in isolation)
// and a real impl (wires into the host). No other module code imports host
// internals.
// ============================================================================

export type AuctionRole = "manage" | "auctioneer" | "clerk" | "bidder";

export type PermissionAction =
  | "auction.manage" // create/edit auctions & lots, open/close
  | "auction.clerk" // run the console: floor/phone bids, accept/reject, hammer
  | "auction.bid"; // place an online bid

export interface HostUser {
  id: string;
  displayName: string;
  roles: AuctionRole[];
}

export type PlatformEventType =
  | "auction.lot_sold"
  | "auction.lot_passed"
  | "auction.user_registered"
  | "auction.charge_requested";

export interface PlatformEvent {
  type: PlatformEventType;
  at: string; // ISO timestamp
  auctionId?: string;
  lotId?: string;
  sourceRef?: string | null; // optional link to a host record (e.g. consignment item)
  userId?: string;
  paddleNo?: number;
  amountCents?: number;
  [key: string]: unknown;
}

export interface HostAdapters {
  /** The signed-in platform user, or null. */
  getCurrentUser(): Promise<HostUser | null>;
  /** Throw if `userId` may not perform `action`. */
  assertPermission(userId: string, action: PermissionAction): Promise<void>;
  /** Payments are the host's job; the module only requests a charge. */
  recordCharge(userId: string, lotId: string, amountCents: number): Promise<void>;
  /** Let the host react to module events (lot sold, user registered, …). */
  emitPlatformEvent(event: PlatformEvent): Promise<void>;
}

export class PermissionError extends Error {
  constructor(action: string) {
    super(`Permission denied: ${action}`);
    this.name = "PermissionError";
  }
}
