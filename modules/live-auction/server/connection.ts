// The bidding server's connection handler, extracted so it can be attached to
// either the standalone server (server/index.ts) or the combined Next custom
// server (server.ts at the repo root). The in-memory `rooms` map lives here, so
// there is exactly ONE authoritative set of rooms per process.
import type { WebSocket, WebSocketServer } from "ws";
import { authenticate } from "./auth";
import { Room, type Client } from "./rooms";
import { loadRegistration } from "./persistence";
import { permitted } from "../adapters/roles";
import type { ClientMessage, ServerMessage } from "./protocol";

const rooms = new Map<string, Room>();

async function getRoom(lotId: string): Promise<Room | null> {
  let room = rooms.get(lotId);
  if (!room) {
    const loaded = await Room.load(lotId);
    if (loaded) {
      room = loaded;
      rooms.set(lotId, room);
    }
  }
  return room ?? null;
}

function reply(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

/** Wire the auction protocol onto a WebSocketServer's connections. */
export function attachAuctionWss(wss: WebSocketServer): void {
  wss.on("connection", (ws) => {
    let client: Client | null = null;
    let room: Room | null = null;

    ws.on("message", async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.t === "ping") return reply(ws, { t: "pong" });

      if (msg.t === "hello") {
        const user = await authenticate(msg.token);
        if (!user) {
          reply(ws, { t: "error", message: "unauthorized" });
          return ws.close();
        }
        const r = await getRoom(msg.lotId);
        if (!r) {
          reply(ws, { t: "error", message: "lot_not_found" });
          return ws.close();
        }
        const reg = await loadRegistration(r.auctionId, user.id);
        client = {
          ws,
          user,
          registrationId: reg?.id ?? null,
          paddleNo: reg?.paddleNo ?? null,
          registered: reg?.status === "approved",
        };
        room = r;
        r.add(client);
        r.welcome(client);
        return;
      }

      if (!client || !room) {
        return reply(ws, { t: "error", message: "say_hello_first" });
      }

      if (msg.t === "bid") {
        if (!permitted(client.user.roles, "auction.bid")) {
          return reply(ws, { t: "error", message: "forbidden" });
        }
        return room.handleBid(client, msg);
      }

      if (msg.t === "ctrl") {
        if (!permitted(client.user.roles, "auction.clerk")) {
          return reply(ws, { t: "error", message: "forbidden" });
        }
        return room.handleControl(client, msg);
      }
    });

    ws.on("close", () => {
      if (room && client) room.remove(client);
    });
    ws.on("error", () => {
      if (room && client) room.remove(client);
    });
  });
}
