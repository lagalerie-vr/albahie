# Deploying AlBahie — one service

The whole platform runs as **one container**: the Next.js app and the
authoritative bidding WebSocket server share a single process (`server.ts`),
serving HTTP and `wss://…/auction-ws` on the same port.

You only manage **one deployment**. Two things stay external and managed for you:

| Component | Where | Effort |
|-----------|-------|--------|
| App + bidding server | **one container** (Railway / Render / Fly) | this guide |
| Database / Auth / Storage | Supabase | already live |
| Video (OBS → viewers) | LiveKit Cloud | already live |

> Why not Vercel? Vercel is serverless and can't run the always-on, stateful
> bidding process — so the app goes on Vercel and the bidding server goes on a
> small always-on host. (Or run everything in one container; see further down.)

---

## Quickstart: working prototype (Vercel + Railway)

The fastest way to get a live prototype: **Vercel** for the web app, **Railway**
for the one always-on bidding server. ~10 minutes.

**Minimum to work:** Supabase (already set up) + these two hosts. LiveKit, Stripe,
and SMTP are optional — without them, video shows "not configured", payments use
the mock pay page, and emails are skipped; everything else (including bidding) works.

### 1) Bidding server → Railway
1. Push the repo to GitHub.
2. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
3. Service → **Settings**:
   - **Build → Builder:** Nixpacks
   - **Build → Build Command:** `npm install`
   - **Deploy → Start Command:** `npm run auction-server`
   - **Deploy → Healthcheck Path:** `/health`
4. **Variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   (`PORT` is injected. Add `SMTP_*` later if you want sale emails.)
5. **Settings → Networking → Generate Domain** → e.g. `bids-production.up.railway.app`.
6. Check `https://bids-production.up.railway.app/health` → `ok`.
   Your WS URL is `wss://bids-production.up.railway.app`.

### 2) Web app → Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → import the same repo
   (Next.js auto-detected; the custom `server.ts` is ignored on Vercel — that's fine).
2. **Environment Variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NEXT_PUBLIC_AUCTION_WS_URL=wss://bids-production.up.railway.app
   NEXT_PUBLIC_SITE_URL=https://<your-app>.vercel.app
   # optional: LIVEKIT_*, NEXT_PUBLIC_LIVEKIT_URL, STRIPE_*, SMTP_*
   ```
3. **Deploy.** (First deploy gives you the `.vercel.app` domain — set
   `NEXT_PUBLIC_SITE_URL` to it and redeploy.)

### 3) Webhooks (optional — enables auto-live + Stripe)
- LiveKit → Webhooks → `https://<your-app>.vercel.app/api/livekit/webhook`
- Stripe → Webhooks → `https://<your-app>.vercel.app/api/stripe/webhook`
  (events `invoice.paid`, `invoice.payment_succeeded`; put the signing secret in
  `STRIPE_WEBHOOK_SECRET` on Vercel).

### 4) Make an admin user (if you don't have one)
Locally, with `.env.local` filled in:
```bash
node scripts/admin.mjs create-admin you@example.com "YourPassword" "Your Name"
```

Then open the Vercel URL, sign in, and run a test sale end to end.

---

## Run it as a Docker image

The repo includes a `Dockerfile` that produces one image (app + bidding server).

**Build locally** (the `NEXT_PUBLIC_*` values are baked into the browser bundle,
so pass them as build args — they're public, not secrets):

```bash
docker build -t albahie \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  --build-arg NEXT_PUBLIC_LIVEKIT_URL=wss://xxxx.livekit.cloud \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain .
```

**Run it** (server-side secrets come from the env file — copy `.env.example` to
`.env.runtime` and fill it in):

```bash
docker run -d -p 3000:3000 --env-file .env.runtime --name albahie albahie
# → app on http://localhost:3000, bidding WS on ws://localhost:3000/auction-ws
```

**Push to a registry** (so any server can `docker pull` it):

```bash
docker tag albahie ghcr.io/<you>/albahie:latest
docker push ghcr.io/<you>/albahie:latest
```

**Or let CI build it for you** — `.github/workflows/docker-image.yml` builds and
pushes to GHCR on every push to `main`. Add the four `NEXT_PUBLIC_*` repo secrets,
push, then anywhere:

```bash
docker pull ghcr.io/<owner>/<repo>:latest
docker run -d -p 3000:3000 --env-file .env.runtime ghcr.io/<owner>/<repo>:latest
```

Point a reverse proxy / your host's TLS at port 3000, and set the LiveKit + Stripe
webhooks at `https://<your-domain>/api/livekit/webhook` and `/api/stripe/webhook`.

---

## Railway (recommended)

1. Push this repo to GitHub.
2. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
   Railway detects the `Dockerfile` and builds it.
3. **Generate a domain**: Service → Settings → Networking → **Generate Domain**
   (e.g. `albahie-production.up.railway.app`).
4. Service → **Variables**, add everything (one service does it all):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   LIVEKIT_URL=wss://<you>.livekit.cloud
   LIVEKIT_API_KEY=...        LIVEKIT_API_SECRET=...
   NEXT_PUBLIC_LIVEKIT_URL=wss://<you>.livekit.cloud
   STRIPE_SECRET_KEY=sk_test_or_live...
   STRIPE_WEBHOOK_SECRET=whsec_...            # from step 6
   SMTP_HOST=...  SMTP_PORT=465  SMTP_USER=...  SMTP_PASS=...  SMTP_FROM="AlBahie <you@domain>"
   NEXT_PUBLIC_SITE_URL=https://<your-railway-domain>
   ```
   Notes:
   - `PORT` is injected by Railway — don't set it.
   - `NEXT_PUBLIC_AUCTION_WS_URL` is **not needed** — the client auto-connects to
     `wss://<same-domain>/auction-ws`.
   - `NEXT_PUBLIC_*` are read at **build time**, so after first setting them,
     trigger a redeploy.
5. **Redeploy** (so the build picks up the env). Visit the domain → sign in.
6. **Webhooks** (now public, so auto-live + payments work):
   - LiveKit dashboard → Webhooks → `https://<domain>/api/livekit/webhook`
     (OBS start → auction **live**, OBS stop → **ended**).
   - Stripe → Developers → Webhooks → `https://<domain>/api/stripe/webhook`,
     events `invoice.paid` + `invoice.payment_succeeded` → copy the signing
     secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

That's it — one URL serves the app, the bidding socket, and the webhooks.

## Render (alternative)
New → **Web Service** → from repo → Environment **Docker** → add the same env
vars → deploy. Render injects `PORT` and builds the `Dockerfile`.

## Fly.io (alternative)
`fly launch` (detects the `Dockerfile`) → in `fly.toml` set
`[http_service] internal_port = 3000` and `[env] PORT = "3000"` →
`fly secrets set SUPABASE_SERVICE_ROLE_KEY=… LIVEKIT_API_SECRET=… …` →
`fly deploy`.

---

## OBS (unchanged)
Get the WHIP URL + bearer from the auction **control panel**; OBS publishes to
LiveKit Cloud. The platform shows the live feed and runs the sale.

## Local development (unchanged, stays fast)
`npm run dev:all` still runs Next (Turbopack) + the standalone bidding server on
`ws://localhost:4001`. The custom combined `server.ts` is only for production —
it keeps local dev fast.

## Notes
- Run **one** instance (one container). The bidding state is in-memory and
  authoritative; never run two instances for the same auction.
- Apply DB migrations (`supabase/migrations/*.sql`) to Supabase separately.
- Set `STRIPE_WEBHOOK_SECRET` in production so the Stripe webhook is verified.
- You shared the DB password / service-role key earlier — rotate them in Supabase.
