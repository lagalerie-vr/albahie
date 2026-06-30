// Combined single-process server: serves the Next.js app AND the authoritative
// bidding WebSocket on the same port (path /auction-ws). This is what makes the
// whole platform deployable as ONE service/container.
//
//   Production:  next build  &&  NODE_ENV=production tsx server.ts
//   (Local dev still uses `npm run dev` + `npm run auction-server` separately,
//    which keeps Turbopack fast.)
import { createServer } from "node:http";
import next from "next";
import { WebSocketServer } from "ws";
import { loadEnv } from "./modules/live-auction/server/env";
import { attachAuctionWss } from "./modules/live-auction/server/connection";

loadEnv();

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));

  // Bidding WebSocket on /auction-ws (same origin as the app).
  const wss = new WebSocketServer({ noServer: true });
  attachAuctionWss(wss);

  const nextUpgrade =
    typeof app.getUpgradeHandler === "function" ? app.getUpgradeHandler() : null;

  server.on("upgrade", (req, socket, head) => {
    if (req.url && req.url.startsWith("/auction-ws")) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else if (nextUpgrade) {
      // Let Next handle its own upgrades (e.g. HMR in dev).
      nextUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(`▲ AlBahie (web + bidding) listening on :${port}`);
  });
});
