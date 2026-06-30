-- ============================================================================
-- 0006_auction_schema.sql
-- Live Auction module. Fully namespaced in the `auction` schema so it stays
-- decoupled from the host platform. All money is stored in integer CENTS.
-- ============================================================================

create schema if not exists auction;
create extension if not exists pgcrypto;

-- Expose the schema to PostgREST (so supabase-js can use .schema('auction')).
-- Includes the Supabase defaults so nothing else breaks.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, auction';

grant usage on schema auction to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helper: can the current user manage auctions (admin/staff)?
-- ---------------------------------------------------------------------------
create or replace function auction.can_manage()
returns boolean
language sql
security definer
set search_path = public, auction
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff') and is_active
  );
$$;

-- ---------------------------------------------------------------------------
-- Auctions
-- ---------------------------------------------------------------------------
create table if not exists auction.auctions (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  status             text not null default 'draft',   -- draft|scheduled|live|ended
  starts_at          timestamptz,
  -- increment ladder: [{ "upToCents": <int|null>, "stepCents": <int> }, ...]
  increments         jsonb not null default
    '[{"upToCents":100000,"stepCents":5000},{"upToCents":500000,"stepCents":10000},{"upToCents":2000000,"stepCents":25000},{"upToCents":null,"stepCents":50000}]'::jsonb,
  soft_close_seconds int  not null default 30,
  video_room         text,
  created_by         uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Registrations (paddle per user per auction)
-- ---------------------------------------------------------------------------
create table if not exists auction.registrations (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references auction.auctions (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  paddle_no   int,
  status      text not null default 'pending',         -- pending|approved|suspended
  created_at  timestamptz not null default now(),
  unique (auction_id, user_id),
  unique (auction_id, paddle_no)
);

-- Auto-assign the next paddle number per auction (paddles start at 100).
create or replace function auction.set_paddle_no()
returns trigger
language plpgsql
as $$
begin
  if new.paddle_no is null then
    select coalesce(max(paddle_no), 99) + 1 into new.paddle_no
      from auction.registrations where auction_id = new.auction_id;
  end if;
  return new;
end;
$$;

drop trigger if exists registrations_set_paddle on auction.registrations;
create trigger registrations_set_paddle
  before insert on auction.registrations
  for each row execute function auction.set_paddle_no();

-- ---------------------------------------------------------------------------
-- Lots
-- ---------------------------------------------------------------------------
create table if not exists auction.lots (
  id                       uuid primary key default gen_random_uuid(),
  auction_id               uuid not null references auction.auctions (id) on delete cascade,
  lot_no                   int  not null,
  title                    text not null,
  description              text,
  images                   jsonb not null default '[]'::jsonb,
  low_estimate_cents       bigint,
  high_estimate_cents      bigint,
  reserve_cents            bigint,
  start_price_cents        bigint not null default 0,
  status                   text   not null default 'pending', -- pending|open|fair_warning|sold|passed
  current_price_cents      bigint,
  high_bidder_paddle       int,
  high_bidder_registration uuid references auction.registrations (id),
  winning_amount_cents     bigint,
  sort_order               int  not null default 0,
  source_ref               text,   -- optional link to a host item (decoupled)
  opened_at                timestamptz,
  closed_at                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (auction_id, lot_no)
);

create index if not exists lots_auction_idx on auction.lots (auction_id, sort_order);

-- ---------------------------------------------------------------------------
-- Absentee / proxy bids (stored maximum; engine auto-bids up to it)
-- ---------------------------------------------------------------------------
create table if not exists auction.absentee_bids (
  id              uuid primary key default gen_random_uuid(),
  lot_id          uuid not null references auction.lots (id) on delete cascade,
  registration_id uuid not null references auction.registrations (id) on delete cascade,
  max_amount_cents bigint not null check (max_amount_cents > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (lot_id, registration_id)
);

-- ---------------------------------------------------------------------------
-- Bid audit — append-only, immutable. EVERY attempt (accepted AND rejected).
-- Legal record. server_seq gives a global monotonic order.
-- ---------------------------------------------------------------------------
create table if not exists auction.bid_audit (
  id                    uuid primary key default gen_random_uuid(),
  server_seq            bigserial,
  auction_id            uuid not null references auction.auctions (id) on delete cascade,
  lot_id                uuid not null references auction.lots (id) on delete cascade,
  registration_id       uuid references auction.registrations (id),
  paddle_no             int,
  channel               text not null,         -- online|absentee|in_room|phone
  requested_amount_cents bigint,
  resulting_price_cents bigint,
  status                text not null,         -- accepted|rejected
  reason                text,
  idempotency_key       text,
  actor_user_id         uuid,
  created_at            timestamptz not null default now(),
  unique (lot_id, idempotency_key)
);

create index if not exists bid_audit_lot_idx on auction.bid_audit (lot_id, server_seq);

-- ---------------------------------------------------------------------------
-- Lot control events (auctioneer actions) — append-only, immutable.
-- ---------------------------------------------------------------------------
create table if not exists auction.lot_events (
  id            uuid primary key default gen_random_uuid(),
  server_seq    bigserial,
  lot_id        uuid not null references auction.lots (id) on delete cascade,
  type          text not null,    -- open|fair_warning|extend|hammer|sold|pass|reopen|clock
  actor_user_id uuid,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists lot_events_lot_idx on auction.lot_events (lot_id, server_seq);

-- ---------------------------------------------------------------------------
-- Immutability: block UPDATE/DELETE on the legal-record tables (everyone).
-- ---------------------------------------------------------------------------
create or replace function auction.block_modify()
returns trigger
language plpgsql
as $$
begin
  raise exception 'auction.% is append-only and cannot be % ', tg_table_name, tg_op;
end;
$$;

drop trigger if exists bid_audit_immutable on auction.bid_audit;
create trigger bid_audit_immutable
  before update or delete on auction.bid_audit
  for each row execute function auction.block_modify();

drop trigger if exists lot_events_immutable on auction.lot_events;
create trigger lot_events_immutable
  before update or delete on auction.lot_events
  for each row execute function auction.block_modify();

-- updated_at triggers (reuse the host helper)
drop trigger if exists auctions_updated on auction.auctions;
create trigger auctions_updated before update on auction.auctions
  for each row execute function public.set_updated_at();
drop trigger if exists lots_updated on auction.lots;
create trigger lots_updated before update on auction.lots
  for each row execute function public.set_updated_at();
drop trigger if exists absentee_updated on auction.absentee_bids;
create trigger absentee_updated before update on auction.absentee_bids
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants (RLS still gates rows). service_role bypasses RLS (used by the
-- authoritative bidding server).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema auction to authenticated;
grant select on all tables in schema auction to anon;
grant all on all tables in schema auction to service_role;
grant usage, select on all sequences in schema auction to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table auction.auctions       enable row level security;
alter table auction.registrations  enable row level security;
alter table auction.lots           enable row level security;
alter table auction.absentee_bids  enable row level security;
alter table auction.bid_audit      enable row level security;
alter table auction.lot_events     enable row level security;

-- Auctions: anyone authenticated can read; staff/admin manage.
drop policy if exists auctions_read on auction.auctions;
create policy auctions_read on auction.auctions for select to authenticated using (true);
drop policy if exists auctions_manage on auction.auctions;
create policy auctions_manage on auction.auctions for all to authenticated
  using (auction.can_manage()) with check (auction.can_manage());

-- Lots: read by authenticated; staff/admin manage.
drop policy if exists lots_read on auction.lots;
create policy lots_read on auction.lots for select to authenticated using (true);
drop policy if exists lots_manage on auction.lots;
create policy lots_manage on auction.lots for all to authenticated
  using (auction.can_manage()) with check (auction.can_manage());

-- Registrations: read own or manager; self-register; manager updates (approve).
drop policy if exists reg_read on auction.registrations;
create policy reg_read on auction.registrations for select to authenticated
  using (user_id = auth.uid() or auction.can_manage());
drop policy if exists reg_insert on auction.registrations;
create policy reg_insert on auction.registrations for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists reg_update on auction.registrations;
create policy reg_update on auction.registrations for update to authenticated
  using (auction.can_manage()) with check (auction.can_manage());

-- Absentee bids: a bidder manages their own (via their registration).
drop policy if exists absentee_read on auction.absentee_bids;
create policy absentee_read on auction.absentee_bids for select to authenticated
  using (
    auction.can_manage()
    or exists (select 1 from auction.registrations r
               where r.id = registration_id and r.user_id = auth.uid())
  );
drop policy if exists absentee_write on auction.absentee_bids;
create policy absentee_write on auction.absentee_bids for all to authenticated
  using (
    exists (select 1 from auction.registrations r
            where r.id = registration_id and r.user_id = auth.uid())
  )
  with check (
    exists (select 1 from auction.registrations r
            where r.id = registration_id and r.user_id = auth.uid()
              and r.status = 'approved')
  );

-- Audit + events: readable by authenticated; NO client writes (only the
-- service-role bidding server inserts; immutability triggers block changes).
drop policy if exists bid_audit_read on auction.bid_audit;
create policy bid_audit_read on auction.bid_audit for select to authenticated using (true);
drop policy if exists lot_events_read on auction.lot_events;
create policy lot_events_read on auction.lot_events for select to authenticated using (true);

notify pgrst, 'reload config';
