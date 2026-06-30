// The server-authoritative bidding engine. Pure functions: given a lot state +
// context (increment ladder, absentee proxies, clock), decide the outcome of an
// action and return the next state. Deterministic — same inputs, same result.

import type {
  AbsenteeProxy,
  BidDecision,
  BidInput,
  EngineContext,
  LotState,
} from "./types";
import { askingPriceCents, incrementFor } from "./increments";

const MAX_SETTLE_ITERATIONS = 100_000;

export function reserveMet(state: LotState): boolean {
  if (state.reserveCents == null) return true;
  return (state.currentPriceCents ?? 0) >= state.reserveCents;
}

/**
 * Let absentee proxies compete against the current high bidder (live or another
 * proxy), one increment at a time, until none can beat the standing bid. This
 * executes absentee-vs-live AND absentee-vs-absentee correctly.
 */
function settleProxies(
  state: LotState,
  ctx: EngineContext,
): { state: LotState; proxyApplied: boolean } {
  let next = state;
  let proxyApplied = false;

  for (let i = 0; i < MAX_SETTLE_ITERATIONS; i++) {
    const asking =
      next.currentPriceCents === null
        ? next.startPriceCents
        : next.currentPriceCents + incrementFor(next.currentPriceCents, ctx.ladder);

    // Strongest proxy that can meet `asking` and isn't already the high bidder.
    const candidate = bestProxy(
      ctx.proxies,
      asking,
      next.highBidderRegistrationId,
    );
    if (!candidate) break;

    next = {
      ...next,
      currentPriceCents: asking,
      highBidderRegistrationId: candidate.registrationId,
      highBidderPaddle: candidate.paddleNo,
    };
    proxyApplied = true;
  }

  return { state: next, proxyApplied };
}

function bestProxy(
  proxies: AbsenteeProxy[],
  asking: number,
  excludeRegistrationId: string | null,
): AbsenteeProxy | null {
  let best: AbsenteeProxy | null = null;
  for (const p of proxies) {
    if (p.registrationId === excludeRegistrationId) continue;
    if (p.maxAmountCents < asking) continue;
    if (
      !best ||
      p.maxAmountCents > best.maxAmountCents ||
      (p.maxAmountCents === best.maxAmountCents && p.seq < best.seq)
    ) {
      best = p;
    }
  }
  return best;
}

/** Open a lot for bidding, then let any absentee proxies establish the opening. */
export function openLot(state: LotState, ctx: EngineContext): LotState {
  if (state.status !== "pending" && state.status !== "passed") return state;
  const opened: LotState = {
    ...state,
    status: "open",
    currentPriceCents: null,
    highBidderRegistrationId: null,
    highBidderPaddle: null,
    endsAt: null,
  };
  return settleProxies(opened, ctx).state;
}

/** Apply an incoming bid (online live / floor / phone). Absentees auto-respond. */
export function applyBid(
  state: LotState,
  ctx: EngineContext,
  input: BidInput,
): BidDecision {
  if (state.status !== "open" && state.status !== "fair_warning") {
    return reject(state, "lot_not_open");
  }
  if (state.endsAt !== null && ctx.now > state.endsAt) {
    return reject(state, "lot_closed");
  }

  const asking = askingPriceCents(state, ctx.ladder);
  const amount = input.amountCents ?? asking;

  if (amount < asking) {
    return reject(state, "below_asking");
  }
  if (
    input.registrationId !== null &&
    state.highBidderRegistrationId === input.registrationId
  ) {
    return reject(state, "already_high_bidder");
  }

  // The incoming bid takes the lead at its amount.
  let next: LotState = {
    ...state,
    currentPriceCents: amount,
    highBidderRegistrationId: input.registrationId,
    highBidderPaddle: input.paddleNo,
  };

  // Absentee proxies respond.
  const settled = settleProxies(next, ctx);
  next = settled.state;

  // Re-arm the soft-close clock on every accepted bid.
  next = { ...next, endsAt: ctx.now + ctx.softCloseMs };

  return {
    accepted: true,
    state: next,
    resultingPriceCents: next.currentPriceCents ?? amount,
    proxyApplied: settled.proxyApplied,
  };
}

/** Auctioneer: declare fair warning (about to sell). */
export function setFairWarning(state: LotState): LotState {
  if (state.status !== "open") return state;
  return { ...state, status: "fair_warning" };
}

/** Auctioneer: hammer/sell. Succeeds only if a high bid exists and reserve met. */
export function hammer(state: LotState): BidDecision {
  if (state.status !== "open" && state.status !== "fair_warning") {
    return reject(state, "lot_not_live");
  }
  if (state.currentPriceCents === null || state.highBidderRegistrationId === null) {
    return reject(state, "no_bids");
  }
  if (!reserveMet(state)) {
    return reject(state, "reserve_not_met");
  }
  return {
    accepted: true,
    state: { ...state, status: "sold", endsAt: null },
    resultingPriceCents: state.currentPriceCents,
    proxyApplied: false,
  };
}

/** Auctioneer: pass / unsold. */
export function passLot(state: LotState): LotState {
  if (state.status === "sold") return state;
  return { ...state, status: "passed", endsAt: null };
}

/** Extend the soft-close clock (e.g. late bid arrived near the deadline). */
export function extendClock(state: LotState, ctx: EngineContext): LotState {
  return { ...state, endsAt: ctx.now + ctx.softCloseMs };
}

function reject(state: LotState, reason: string): BidDecision {
  return { accepted: false, reason, state, proxyApplied: false };
}
