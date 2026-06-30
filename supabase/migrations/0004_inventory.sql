-- ============================================================================
-- 0004_inventory.sql
-- Inventory module: physical location on each item + a unified activity log.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Location on the item (where the physical object currently sits).
-- ---------------------------------------------------------------------------
alter table public.consignment_items
  add column if not exists location text not null default 'Holding Tray';

create index if not exists consignment_items_location_idx
  on public.consignment_items (location);

-- ---------------------------------------------------------------------------
-- Activity log: any update made to an item (intake, edits, location moves…).
-- Appraisal decisions live in appraisal_events and are merged in at read time.
-- ---------------------------------------------------------------------------
create table if not exists public.item_activity (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.consignment_items (id) on delete cascade,
  kind       text not null,            -- received | updated | location | photos | note
  summary    text not null,
  detail     text,
  actor      uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists item_activity_item_idx
  on public.item_activity (item_id, created_at desc);

alter table public.item_activity enable row level security;

drop policy if exists "item_activity_select" on public.item_activity;
create policy "item_activity_select"
  on public.item_activity for select to authenticated using (true);

drop policy if exists "item_activity_insert" on public.item_activity;
create policy "item_activity_insert"
  on public.item_activity for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- Backfill a "received" activity for items that already exist.
-- ---------------------------------------------------------------------------
insert into public.item_activity (item_id, kind, summary, detail, actor, created_at)
select ci.id, 'received', 'Item received into inventory', ci.location,
       c.received_by, ci.received_at
from public.consignment_items ci
join public.consignments c on c.id = ci.consignment_id
where not exists (
  select 1 from public.item_activity a
  where a.item_id = ci.id and a.kind = 'received'
);
