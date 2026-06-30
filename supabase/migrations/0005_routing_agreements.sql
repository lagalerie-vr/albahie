-- ============================================================================
-- 0005_routing_agreements.sql
-- Acceptance routing (auction / private sale), commercial terms, and the
-- consignment agreement generated on acceptance.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Auctions (sale events). Minimal now; the Auctions module will extend this.
-- ---------------------------------------------------------------------------
create table if not exists public.auctions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sale_date  date,
  location   text,
  status     text not null default 'upcoming',  -- upcoming | closed
  created_at timestamptz not null default now()
);

alter table public.auctions enable row level security;

drop policy if exists "auctions_select" on public.auctions;
create policy "auctions_select" on public.auctions
  for select to authenticated using (true);
drop policy if exists "auctions_insert" on public.auctions;
create policy "auctions_insert" on public.auctions
  for insert to authenticated with check (true);
drop policy if exists "auctions_update" on public.auctions;
create policy "auctions_update" on public.auctions
  for update to authenticated using (true) with check (true);
drop policy if exists "auctions_delete" on public.auctions;
create policy "auctions_delete" on public.auctions
  for delete to authenticated using (public.is_admin());

-- Seed a few upcoming sale events so the routing dropdown is usable.
insert into public.auctions (name, sale_date, location)
select * from (values
  ('Spring Fine Art Sale', (current_date + 30), 'Main Saleroom'),
  ('Summer Decorative Arts', (current_date + 60), 'Main Saleroom'),
  ('Autumn Jewellery & Watches', (current_date + 90), 'Main Saleroom')
) as v(name, sale_date, location)
where not exists (select 1 from public.auctions);

-- ---------------------------------------------------------------------------
-- Routing + commercial terms + agreement on the item.
-- ---------------------------------------------------------------------------
alter table public.consignment_items
  add column if not exists routing_track text,                 -- auction | private | null
  add column if not exists auction_id uuid references public.auctions (id),
  add column if not exists seller_commission numeric(5,2),
  add column if not exists reserve_price numeric(12,2),
  add column if not exists asking_price numeric(12,2),
  add column if not exists private_sale_months int,
  add column if not exists agreement_number text unique,
  add column if not exists agreement_generated_at timestamptz;

create sequence if not exists public.agreement_seq;

-- Assign an agreement number the first time an agreement is generated.
create or replace function public.set_agreement_number()
returns trigger
language plpgsql
as $$
begin
  if new.agreement_generated_at is not null
     and (old.agreement_generated_at is null)
     and new.agreement_number is null then
    new.agreement_number := 'AG-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.agreement_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists consignment_items_set_agreement on public.consignment_items;
create trigger consignment_items_set_agreement
  before update on public.consignment_items
  for each row execute function public.set_agreement_number();
