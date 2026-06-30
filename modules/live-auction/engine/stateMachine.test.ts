import { test } from "node:test";
import assert from "node:assert/strict";
import type { AbsenteeProxy, EngineContext, LotState } from "./types";
import { applyBid, openLot, hammer } from "./stateMachine";
import { askingPriceCents, incrementFor } from "./increments";

const ladder = [
  { upToCents: 100_00, stepCents: 5_00 },
  { upToCents: 500_00, stepCents: 10_00 },
  { upToCents: null, stepCents: 25_00 },
];

function baseLot(over: Partial<LotState> = {}): LotState {
  return {
    lotId: "lot1",
    auctionId: "auc1",
    status: "pending",
    startPriceCents: 50_00,
    reserveCents: null,
    currentPriceCents: null,
    highBidderRegistrationId: null,
    highBidderPaddle: null,
    endsAt: null,
    ...over,
  };
}

function ctx(proxies: AbsenteeProxy[] = []): EngineContext {
  return { ladder, proxies, softCloseMs: 30_000, now: 1_000 };
}

test("increment ladder picks the right step", () => {
  assert.equal(incrementFor(50_00, ladder), 5_00);
  assert.equal(incrementFor(200_00, ladder), 10_00);
  assert.equal(incrementFor(900_00, ladder), 25_00);
});

test("opening with no bids asks the start price", () => {
  const s = openLot(baseLot(), ctx());
  assert.equal(s.status, "open");
  assert.equal(s.currentPriceCents, null);
  assert.equal(askingPriceCents(s, ladder), 50_00);
});

test("an online bid takes the lead and re-arms the clock", () => {
  const s = openLot(baseLot(), ctx());
  const d = applyBid(s, ctx(), {
    channel: "online",
    registrationId: "r1",
    paddleNo: 101,
  });
  assert.equal(d.accepted, true);
  assert.equal(d.state.currentPriceCents, 50_00);
  assert.equal(d.state.highBidderPaddle, 101);
  assert.equal(d.state.endsAt, 1_000 + 30_000);
});

test("a bid below asking is rejected", () => {
  let s = openLot(baseLot({ startPriceCents: 50_00 }), ctx());
  s = applyBid(s, ctx(), { channel: "online", registrationId: "r1", paddleNo: 101 }).state;
  const d = applyBid(s, ctx(), {
    channel: "online",
    registrationId: "r2",
    paddleNo: 102,
    amountCents: 52_00, // asking is 55_00
  });
  assert.equal(d.accepted, false);
  assert.equal(d.reason, "below_asking");
});

test("you cannot outbid yourself", () => {
  let s = openLot(baseLot(), ctx());
  s = applyBid(s, ctx(), { channel: "online", registrationId: "r1", paddleNo: 101 }).state;
  const d = applyBid(s, ctx(), { channel: "online", registrationId: "r1", paddleNo: 101 });
  assert.equal(d.accepted, false);
  assert.equal(d.reason, "already_high_bidder");
});

test("absentee proxy auto-bids against a live bid", () => {
  const proxies: AbsenteeProxy[] = [
    { registrationId: "rA", paddleNo: 200, maxAmountCents: 200_00, seq: 1 },
  ];
  const s = openLot(baseLot(), ctx(proxies));
  // proxy opens at start price (50_00) as the lone absentee
  assert.equal(s.currentPriceCents, 50_00);
  assert.equal(s.highBidderRegistrationId, "rA");

  // live bidder bids the asking (55_00); proxy should respond up one increment
  const d = applyBid(s, ctx(proxies), {
    channel: "online",
    registrationId: "r1",
    paddleNo: 101,
  });
  assert.equal(d.accepted, true);
  assert.equal(d.proxyApplied, true);
  assert.equal(d.state.highBidderRegistrationId, "rA"); // proxy back on top
  assert.equal(d.state.currentPriceCents, 60_00); // 55_00 + 5_00 step
});

test("two absentees: highest max wins one increment above the other", () => {
  const proxies: AbsenteeProxy[] = [
    { registrationId: "rA", paddleNo: 200, maxAmountCents: 300_00, seq: 1 },
    { registrationId: "rB", paddleNo: 201, maxAmountCents: 150_00, seq: 2 },
  ];
  const s = openLot(baseLot(), ctx(proxies));
  assert.equal(s.highBidderRegistrationId, "rA");
  // rB max is 150_00; rA should lead one increment above that (160_00 @ 10_00 step)
  assert.equal(s.currentPriceCents, 160_00);
});

test("hammer requires reserve to be met", () => {
  const proxies: AbsenteeProxy[] = [];
  let s = openLot(baseLot({ reserveCents: 100_00 }), ctx(proxies));
  s = applyBid(s, ctx(proxies), { channel: "online", registrationId: "r1", paddleNo: 101 }).state;
  // current is 50_00, below reserve 100_00
  const blocked = hammer(s);
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.reason, "reserve_not_met");
});
