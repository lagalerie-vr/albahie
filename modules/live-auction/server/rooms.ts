// One Room per lot. Holds the authoritative in-memory state and serialises all
// mutations through a single async queue so simultaneous bids resolve strictly
// by server receipt order. There is ONE authoritative instance per auction
// (see README scaling notes).
import type { WebSocket } from "ws";
import type {
  AbsenteeProxy,
  IncrementRung,
  LotState,
} from "../engine/types";
import {
  applyBid,
  extendClock,
  hammer,
  openLot,
  passLot,
  reserveMet,
  setFairWarning,
} from "../engine/stateMachine";
import { askingPriceCents } from "../engine/increments";
import type {
  ClientMessage,
  ConnectedUser,
  LotSnapshot,
  ServerMessage,
} from "./protocol";
import type { AuthedUser } from "./auth";
import * as db from "./persistence";

export interface Client {
  ws: WebSocket;
  user: AuthedUser;
  registrationId: string | null;
  paddleNo: number | null;
  registered: boolean;
}

export class Room {
  readonly lotId: string;
  readonly auctionId: string;
  private state: LotState;
  private ladder: IncrementRung[];
  private softCloseMs: number;
  private proxies: AbsenteeProxy[];
  private sourceRef: string | null;
  private clients = new Set<Client>();
  private seen = new Map<string, { accepted: boolean; reason?: string }>();
  private queue: Promise<unknown> = Promise.resolve();
  private timer: NodeJS.Timeout | null = null;

  private constructor(loaded: db.LoadedLot, proxies: AbsenteeProxy[]) {
    this.lotId = loaded.state.lotId;
    this.auctionId = loaded.state.auctionId;
    this.state = loaded.state;
    this.ladder = loaded.ladder;
    this.softCloseMs = loaded.softCloseMs;
    this.proxies = proxies;
    this.sourceRef = loaded.sourceRef;
  }

  static async load(lotId: string): Promise<Room | null> {
    const loaded = await db.loadLot(lotId);
    if (!loaded) return null;
    const proxies = await db.loadProxies(lotId);
    return new Room(loaded, proxies);
  }

  // ── client membership ──────────────────────────────────────────────
  add(client: Client) {
    this.clients.add(client);
  }
  remove(client: Client) {
    this.clients.delete(client);
  }
  get size() {
    return this.clients.size;
  }

  snapshot(): LotSnapshot {
    return {
      lotId: this.state.lotId,
      auctionId: this.state.auctionId,
      status: this.state.status,
      currentPriceCents: this.state.currentPriceCents,
      askingPriceCents: askingPriceCents(this.state, this.ladder),
      highBidderPaddle: this.state.highBidderPaddle,
      reserveMet: reserveMet(this.state),
      endsAt: this.state.endsAt,
      serverTime: Date.now(),
    };
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }
  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const c of this.clients) if (c.ws.readyState === c.ws.OPEN) c.ws.send(data);
  }
  broadcastState() {
    this.broadcast({ t: "state", lot: this.snapshot() });
  }

  welcome(client: Client) {
    const user: ConnectedUser = {
      id: client.user.id,
      displayName: client.user.displayName,
      roles: client.user.roles,
      paddleNo: client.paddleNo,
      registered: client.registered,
    };
    this.send(client.ws, { t: "welcome", user, lot: this.snapshot() });
  }

  // Serialise every state mutation.
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
  private armTimer() {
    this.clearTimer();
    if (this.state.endsAt == null) return;
    const ms = Math.max(0, this.state.endsAt - Date.now());
    this.timer = setTimeout(() => this.broadcastState(), ms + 20);
  }

  // ── bids (online live; floor/phone are Phase 2 via ctrl) ───────────
  async handleBid(client: Client, msg: Extract<ClientMessage, { t: "bid" }>) {
    if (!client.registered || client.registrationId == null) {
      this.send(client.ws, {
        t: "bid.result",
        idempotencyKey: msg.idempotencyKey,
        accepted: false,
        reason: "not_registered",
      });
      return;
    }
    const cached = this.seen.get(msg.idempotencyKey);
    if (cached) {
      this.send(client.ws, { t: "bid.result", idempotencyKey: msg.idempotencyKey, ...cached });
      return;
    }

    await this.run(async () => {
      const again = this.seen.get(msg.idempotencyKey);
      if (again) {
        this.send(client.ws, { t: "bid.result", idempotencyKey: msg.idempotencyKey, ...again });
        return;
      }

      const decision = applyBid(
        this.state,
        { ladder: this.ladder, proxies: this.proxies, softCloseMs: this.softCloseMs, now: Date.now() },
        {
          channel: "online",
          registrationId: client.registrationId,
          paddleNo: client.paddleNo,
          amountCents: msg.amountCents,
        },
      );

      const result = { accepted: decision.accepted, reason: decision.reason };
      this.seen.set(msg.idempotencyKey, result);

      if (decision.accepted) this.state = decision.state;

      // Respond + broadcast immediately (latency path), persist after.
      this.send(client.ws, { t: "bid.result", idempotencyKey: msg.idempotencyKey, ...result });
      if (decision.accepted) {
        this.armTimer();
        this.broadcastState();
      }

      await db.appendAudit({
        auctionId: this.auctionId,
        lotId: this.lotId,
        registrationId: client.registrationId,
        paddleNo: client.paddleNo,
        channel: "online",
        requestedAmountCents: msg.amountCents ?? null,
        resultingPriceCents: decision.accepted ? decision.resultingPriceCents ?? null : null,
        status: decision.accepted ? "accepted" : "rejected",
        reason: decision.reason ?? null,
        idempotencyKey: msg.idempotencyKey,
        actorUserId: client.user.id,
      });
      if (decision.accepted) await db.saveLot(this.state);
    });
  }

  // ── auctioneer / clerk controls ────────────────────────────────────
  async handleControl(client: Client, msg: Extract<ClientMessage, { t: "ctrl" }>) {
    await this.run(async () => {
      const now = Date.now();
      const ctx = { ladder: this.ladder, proxies: this.proxies, softCloseMs: this.softCloseMs, now };

      switch (msg.action) {
        case "open":
        case "reopen": {
          this.proxies = await db.loadProxies(this.lotId);
          this.state = openLot(this.state, { ...ctx, proxies: this.proxies });
          this.clearTimer();
          await db.saveLot(this.state, { openedAt: new Date().toISOString() });
          await db.appendEvent(this.lotId, msg.action, client.user.id);
          this.broadcastState();
          break;
        }
        case "reload_absentee": {
          this.proxies = await db.loadProxies(this.lotId);
          await db.appendEvent(this.lotId, "reload_absentee", client.user.id);
          this.broadcastState();
          break;
        }
        case "fair_warning": {
          this.state = setFairWarning(this.state);
          await db.appendEvent(this.lotId, "fair_warning", client.user.id);
          this.broadcastState();
          break;
        }
        case "extend": {
          this.state = extendClock(this.state, ctx);
          this.armTimer();
          await db.appendEvent(this.lotId, "extend", client.user.id, { endsAt: this.state.endsAt });
          this.broadcastState();
          break;
        }
        case "pass": {
          this.state = passLot(this.state);
          this.clearTimer();
          await db.saveLot(this.state, { closedAt: new Date().toISOString() });
          await db.appendEvent(this.lotId, "pass", client.user.id);
          this.broadcastState();
          break;
        }
        case "floor_bid": {
          // Clerk-entered bid on behalf of an in-room or phone bidder.
          const channel = msg.channel === "phone" ? "phone" : "in_room";
          if (msg.paddleNo == null) {
            this.send(client.ws, { t: "error", message: "paddle_required" });
            return;
          }
          const reg = await db.registrationByPaddle(this.auctionId, msg.paddleNo);
          if (!reg) {
            this.send(client.ws, { t: "error", message: "unknown_paddle" });
            return;
          }
          if (reg.status !== "approved") {
            this.send(client.ws, { t: "error", message: "paddle_not_approved" });
            return;
          }

          const decision = applyBid(
            { ...this.state },
            { ...ctx, proxies: this.proxies },
            {
              channel,
              registrationId: reg.id,
              paddleNo: reg.paddleNo,
              amountCents: msg.amountCents,
            },
          );

          if (decision.accepted) {
            this.state = decision.state;
            this.armTimer();
          } else {
            this.send(client.ws, { t: "error", message: decision.reason ?? "rejected" });
          }

          await db.appendAudit({
            auctionId: this.auctionId,
            lotId: this.lotId,
            registrationId: reg.id,
            paddleNo: reg.paddleNo,
            channel,
            requestedAmountCents: msg.amountCents ?? null,
            resultingPriceCents: decision.accepted
              ? decision.resultingPriceCents ?? null
              : null,
            status: decision.accepted ? "accepted" : "rejected",
            reason: decision.reason ?? null,
            idempotencyKey: null,
            actorUserId: client.user.id,
          });
          if (decision.accepted) {
            await db.saveLot(this.state);
            this.broadcastState();
          }
          break;
        }
        case "hammer": {
          const decision = hammer(this.state);
          if (!decision.accepted) {
            this.send(client.ws, { t: "error", message: decision.reason ?? "cannot_hammer" });
            return;
          }
          this.state = decision.state;
          this.clearTimer();
          const amount = decision.resultingPriceCents ?? 0;
          await db.saveLot(this.state, {
            winningAmountCents: amount,
            closedAt: new Date().toISOString(),
          });
          await db.appendEvent(this.lotId, "hammer", client.user.id, {
            amountCents: amount,
            paddleNo: this.state.highBidderPaddle,
          });
          this.broadcastState();
          // Notify the host (mark sold, request charge) — outside the latency path.
          const winner = await db.winnerUserId(this.state.highBidderRegistrationId);
          await db.emitLotSold({
            auctionId: this.auctionId,
            lotId: this.lotId,
            sourceRef: this.sourceRef,
            winnerUserId: winner,
            paddleNo: this.state.highBidderPaddle,
            amountCents: amount,
          });
          break;
        }
      }
    });
  }
}
