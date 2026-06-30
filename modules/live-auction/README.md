# Live Auction module

A self-contained, server-authoritative live-auction bidding module. Drops into a
Next.js + TypeScript + Supabase host. All code lives under
`modules/live-auction/`, all DB objects in the Postgres `auction` schema, all
routes under `/auctions/*`, and it talks to the host **only** through the
adapters in `adapters/`.

## Architecture

```
 OBS ──WHIP──▶ LiveKit SFU ──(WebRTC, simulcast)──▶ Bidder browsers   (video, sub-second)
                                                          │
 Bidder / Auctioneer browsers ◀────── WebSocket ─────────┤
                                                          ▼
                                              Bidding server (Node, ws)
                                              • authoritative state machine
                                              • one Room per lot, serialised queue
                                              • only writer of bid state (service role)
                                                          │
                                                          ▼
                                              Supabase Postgres  (schema: auction)
                                              catalog · registrations · absentee
                                              · bid_audit (append-only) · lot_events
```

- **Server-authoritative**, not pub/sub: clients send `bid.request`; the server
  decides and broadcasts. Clients can never write bid state (RLS blocks it; the
  server uses the service role).
- **Latency**: bid round-trip is an in-memory decision then immediate broadcast
  (target **<200ms**); video is WebRTC via LiveKit (target **sub-second**).
  These are realistic targets, not "zero latency".

## Folder layout
```
modules/live-auction/
  adapters/   types · roles · mock · supabase-host · platform · index   (host boundary)
  engine/     types · increments · stateMachine · stateMachine.test      (pure, deterministic)
  server/     protocol · env · auth · persistence · rooms · index        (standalone WS server)
  video/      types · livekit · mock · index                             (pluggable SFU)
  components/ useAuctionSocket · useCountdown · VideoPlayer
              BidderView · AuctioneerConsole · CatalogAdmin
  lib/        client · types
  seed.ts · README.md
src/app/(app)/auctions/…   thin route files → import module components
supabase/migrations/0006_auction_schema.sql
```

## Environment variables
```
# Supabase (host-provided)
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…          # used ONLY by the bidding server + seed

# Bidding server
AUCTION_WS_PORT=4001
NEXT_PUBLIC_AUCTION_WS_URL=ws://localhost:4001
AUCTION_ADAPTERS=host                # or "mock" to run isolated

# Video (LiveKit). Omit all three to run with the placeholder video provider.
LIVEKIT_URL=wss://<project>.livekit.cloud
LIVEKIT_API_KEY=…
LIVEKIT_API_SECRET=…
NEXT_PUBLIC_LIVEKIT_URL=wss://<project>.livekit.cloud
```

## Run a local end-to-end demo
1. Apply the migration `supabase/migrations/0006_auction_schema.sql`.
2. Seed a live auction: `npm run auction-seed` (prints the URLs + paddle).
3. Start the bidding server: `npm run auction-server`.
4. Start the app: `npm run dev`.
5. Open the **Console** URL (as an admin/staff user), select Lot 1, click
   **Open**. Open the **Bidder** URL in another tab/account and click **Bid** —
   price updates in <200ms in both. Try Lot 2 (it has an absentee max of $4,500,
   so it auto-opens via the proxy engine). **Hammer / Sold** closes the lot and
   writes the winning bid; every attempt is in `auction.bid_audit`.

> Multi-user bidding: create a second user (`npm run admin invite …`), register
> them on the auction (Bidder UI → "Register for a paddle"), approve them in the
> Console → Registrations, then bid from both accounts.

## OBS setup (live video)
LiveKit ingests OBS via **WHIP**. In the Console, click **Get WHIP settings** to
create/fetch the ingress, then in OBS:

- **Settings → Stream**
  - Service: **WHIP**
  - Server: the **WHIP URL** shown in the console
  - Bearer Token: the **stream key** shown in the console
- **Settings → Output** (recommended)
  - Encoder: x264 / hardware; **Rate Control: CBR**
  - **Bitrate: 2500–4000 kbps** (1080p30) — LiveKit transcodes to simulcast
    layers so weak viewers auto-downgrade
  - Keyframe interval: **1s**
- **Settings → Video**: 1920×1080, 30 fps
- Click **Start Streaming**. Viewers on the Bidder UI see it within ~1s.

## Wiring the adapters into a host platform
The module touches the host only through `adapters/types.ts`:
```ts
getCurrentUser(): { id, displayName, roles }
assertPermission(userId, action)   // auction.manage | auction.clerk | auction.bid
recordCharge(userId, lotId, amountCents)
emitPlatformEvent(event)           // lot_sold, lot_passed, user_registered, charge_requested
```
- Default real impl: `adapters/supabase-host.ts` (Supabase Auth + `profiles`;
  role mapping in `adapters/roles.ts`). Swap for your own by returning it from
  `adapters/index.ts`.
- `adapters/mock.ts` lets the module run with no host (`AUCTION_ADAPTERS=mock`).
- Lots may carry an optional `source_ref` linking to a host record; on hammer,
  `emitPlatformEvent({type:'auction.lot_sold', sourceRef})` lets the host react
  (this build marks the linked consignment item **sold**).

## Scaling the bidding server
- **One authoritative instance per auction.** Within an instance each lot is a
  `Room` with a single serialised async queue, so simultaneous bids resolve by
  strict server receipt order; idempotency keys dedupe retries.
- To scale out, **shard auctions across instances by `auction_id`** and route a
  lot's WebSocket clients to the instance that owns its auction (sticky by
  auction at the load balancer). Never run two instances for the same auction —
  that would split authority.
- State is rebuildable from Postgres on restart; `bid_audit` is the immutable
  legal record (append-only; UPDATE/DELETE blocked by trigger).

## Phase boundaries
- **Phase 1 (this build):** one live auction, OBS video, online-live + absentee
  bidding, soft-close timer, hammer/sold/pass, full audit log.
- **Phase 2:** in-room + phone clerk channels (wire to `ctrl` floor/phone bids),
  payments via `recordCharge`, multi-auction sharding.
- **Out of scope:** recording/VOD, payment internals, KYC, multi-tenant billing.
