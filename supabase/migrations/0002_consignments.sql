-- ============================================================================
-- 0002_consignments.sql
-- Consignments module: intake / receiving stage and item lifecycle scaffolding.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Item lifecycle status (covers the whole flow; only the intake states are
-- used for now, the rest are placeholders for later stages).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'consignment_status') then
    create type public.consignment_status as enum (
      'awaiting_appraisal',  -- in holding tray, 14-day window running
      'extended_review',     -- manager extended the appraisal
      'declined',            -- rejected, return to consignor
      'accepted',            -- accepted, awaiting routing
      'routed_auction',      -- sent to auction track
      'routed_private',      -- sent to direct private sale
      'cataloged',
      'in_auction',
      'sold',
      'after_sale',
      'sold_privately',
      'returned',
      'withdrawn'
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- Consignors (sellers). Minimal for now; the future Clients module will
-- extend this entity.
-- ---------------------------------------------------------------------------
create table if not exists public.consignors (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text,
  phone       text,
  address     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Consignments = an intake event (one delivery note, 1..n items).
-- ---------------------------------------------------------------------------
create sequence if not exists public.consignment_ref_seq;
create sequence if not exists public.delivery_note_seq;

create table if not exists public.consignments (
  id                   uuid primary key default gen_random_uuid(),
  reference            text unique,            -- CN-YYYY-#####
  delivery_note_number text unique,            -- DN-YYYY-#####
  consignor_id         uuid not null references public.consignors (id),
  received_by          uuid references public.profiles (id),
  received_at          timestamptz not null default now(),
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Consignment items = the lifecycle entity.
-- ---------------------------------------------------------------------------
create table if not exists public.consignment_items (
  id                   uuid primary key default gen_random_uuid(),
  consignment_id       uuid not null references public.consignments (id) on delete cascade,
  reference            text unique,            -- CN-YYYY-#####-NN
  lot_barcode          text unique,            -- barcode/QR payload (= reference)
  title                text not null,
  description          text,
  category             text,
  height_cm            numeric(10,2),
  width_cm             numeric(10,2),
  depth_cm             numeric(10,2),
  weight_kg            numeric(10,3),
  status               public.consignment_status not null default 'awaiting_appraisal',
  responsible_manager  uuid references public.profiles (id),
  received_at          timestamptz not null default now(),
  appraisal_due_at     timestamptz,            -- received_at + 14 days
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists consignment_items_status_idx
  on public.consignment_items (status);
create index if not exists consignment_items_appraisal_due_idx
  on public.consignment_items (appraisal_due_at);
create index if not exists consignment_items_manager_idx
  on public.consignment_items (responsible_manager);

-- ---------------------------------------------------------------------------
-- Item photos (stored in the `consignment-photos` storage bucket).
-- ---------------------------------------------------------------------------
create table if not exists public.consignment_item_photos (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.consignment_items (id) on delete cascade,
  storage_path text not null,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists consignment_item_photos_item_idx
  on public.consignment_item_photos (item_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists consignors_set_updated_at on public.consignors;
create trigger consignors_set_updated_at
  before update on public.consignors
  for each row execute function public.set_updated_at();

drop trigger if exists consignments_set_updated_at on public.consignments;
create trigger consignments_set_updated_at
  before update on public.consignments
  for each row execute function public.set_updated_at();

drop trigger if exists consignment_items_set_updated_at on public.consignment_items;
create trigger consignment_items_set_updated_at
  before update on public.consignment_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reference / delivery-note number generation for consignments.
-- ---------------------------------------------------------------------------
create or replace function public.set_consignment_refs()
returns trigger
language plpgsql
as $$
declare
  yr text := to_char(coalesce(new.received_at, now()), 'YYYY');
begin
  if new.reference is null then
    new.reference := 'CN-' || yr || '-' ||
      lpad(nextval('public.consignment_ref_seq')::text, 5, '0');
  end if;
  if new.delivery_note_number is null then
    new.delivery_note_number := 'DN-' || yr || '-' ||
      lpad(nextval('public.delivery_note_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists consignments_set_refs on public.consignments;
create trigger consignments_set_refs
  before insert on public.consignments
  for each row execute function public.set_consignment_refs();

-- ---------------------------------------------------------------------------
-- Item defaults: reference (per consignment), barcode, 14-day appraisal window.
-- ---------------------------------------------------------------------------
create or replace function public.set_consignment_item_defaults()
returns trigger
language plpgsql
as $$
declare
  cref text;
  pos  int;
begin
  select reference into cref from public.consignments where id = new.consignment_id;

  if new.reference is null then
    select count(*) + 1 into pos
      from public.consignment_items where consignment_id = new.consignment_id;
    new.reference := cref || '-' || lpad(pos::text, 2, '0');
  end if;

  if new.lot_barcode is null then
    new.lot_barcode := new.reference;
  end if;

  if new.received_at is null then
    new.received_at := now();
  end if;

  if new.appraisal_due_at is null then
    new.appraisal_due_at := new.received_at + interval '14 days';
  end if;

  return new;
end;
$$;

drop trigger if exists consignment_items_set_defaults on public.consignment_items;
create trigger consignment_items_set_defaults
  before insert on public.consignment_items
  for each row execute function public.set_consignment_item_defaults();

-- ---------------------------------------------------------------------------
-- Row Level Security: any authenticated staff can read/write; only admins
-- can delete. (Refine per-role later.)
-- ---------------------------------------------------------------------------
alter table public.consignors             enable row level security;
alter table public.consignments           enable row level security;
alter table public.consignment_items      enable row level security;
alter table public.consignment_item_photos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'consignors', 'consignments', 'consignment_items', 'consignment_item_photos'
  ]
  loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_select" on public.%1$s for select to authenticated using (true);', t);

    execute format('drop policy if exists "%1$s_insert" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_insert" on public.%1$s for insert to authenticated with check (true);', t);

    execute format('drop policy if exists "%1$s_update" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_update" on public.%1$s for update to authenticated using (true) with check (true);', t);

    execute format('drop policy if exists "%1$s_delete" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_delete" on public.%1$s for delete to authenticated using (public.is_admin());', t);
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- Storage bucket for item photos + access policies.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('consignment-photos', 'consignment-photos', true)
on conflict (id) do nothing;

drop policy if exists "consignment_photos_read" on storage.objects;
create policy "consignment_photos_read"
  on storage.objects for select
  to public
  using (bucket_id = 'consignment-photos');

drop policy if exists "consignment_photos_write" on storage.objects;
create policy "consignment_photos_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'consignment-photos');

drop policy if exists "consignment_photos_update" on storage.objects;
create policy "consignment_photos_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'consignment-photos');

drop policy if exists "consignment_photos_delete" on storage.objects;
create policy "consignment_photos_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'consignment-photos');
