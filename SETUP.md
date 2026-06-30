# AlBahie — Auction House ERP

Next.js 16 (App Router) + Supabase. This first slice ships **authentication**
(invite-only, email + password) and the **launchpad** that future modules plug
into.

## 1. Create a Supabase project

1. Go to <https://supabase.com> → New project.
2. Once provisioned, open **Project Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key (keep this private)

## 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 3. Run the database migration

In the Supabase dashboard → **SQL Editor**, paste and run
[`supabase/migrations/0001_init_auth.sql`](supabase/migrations/0001_init_auth.sql).

This creates the `profiles` table, the `admin`/`staff` role enum, RLS policies,
and a trigger that auto-creates a profile whenever a user is invited.

## 4. Create the first admin

```bash
npm run admin create-admin you@auctionhouse.com "a-strong-password" "Your Name"
```

## 5. Run it

```bash
npm run dev
```

Open <http://localhost:3000>, sign in, and you'll land on the launchpad.

## Inviting staff

```bash
# Sends an email invite; the user clicks the link and sets their own password.
npm run admin invite colleague@auctionhouse.com staff "Colleague Name"

# Promote/demote later:
npm run admin set-role colleague@auctionhouse.com admin
```

> Email invites require email delivery to be working in your Supabase project
> (the built-in SMTP is rate-limited; configure a custom SMTP for production).
> The invite link redirects to `/auth/confirm`, which signs the user in and
> sends them to `/set-password`.

## How it fits together

| Area | Files |
| --- | --- |
| Supabase clients | `src/lib/supabase/{client,server,middleware}.ts` |
| Auth gate (session refresh + redirects) | `src/proxy.ts` |
| Auth pages & actions | `src/app/(auth)/**` |
| Invite/recovery link handler | `src/app/auth/confirm/route.ts` |
| Protected shell + launchpad | `src/app/(app)/**` |
| **Module registry** | `src/lib/modules.ts` |
| Admin CLI | `scripts/admin.mjs` |

## Adding a module (later)

1. Build the module under `src/app/(app)/<module>/`.
2. Add (or flip to `available`) its entry in `src/lib/modules.ts`.

That's it — it appears on the launchpad, gated by role automatically.
