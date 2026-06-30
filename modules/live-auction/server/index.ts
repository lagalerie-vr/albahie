// Standalone, server-authoritative bidding server (local dev / split hosting).
// For single-host deployment the same handler runs inside the Next custom
// server (see server.ts at the repo root) — both call attachAuctionWss().
//
//   Run:    npm run auction-server
//   Scale:  ONE authoritative instance per auction. Within an instance each lot
//           is a Room with a single serialised queue, so bids resolve by receipt
//           order. Never run two instances for the same auction.
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { loadEnv } from "./env";
import { attachAuctionWss } from "./connection";

loadEnv();

// Hosts (Railway/Render/Fly/…) inject PORT; fall back to the local default.
const port = Number(process.env.PORT ?? process.env.AUCTION_WS_PORT ?? 4001);

// HTTP server: serves a health check (for the host) and upgrades to WebSocket.
const httpServer = createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(426); // Upgrade Required — this endpoint speaks WebSocket
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });
attachAuctionWss(wss);

httpServer.listen(port, () => {
  console.log(`[auction] bidding server listening on :${port}`);
});
