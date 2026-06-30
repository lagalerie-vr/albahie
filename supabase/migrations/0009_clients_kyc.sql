-- ============================================================================
-- 0009_clients_kyc.sql
-- KYC (Know Your Customer) records for clients (public.consignors). A client
-- can hold several documents; each is verified independently. Buyer/seller
-- classification is derived from consignments and auction registrations, so no
-- extra column is needed for it.
-- ============================================================================

create table if not exists public.client_kyc (
  id            uuid primary key default gen_random_uuid(),
  consignor_id  uuid not null references public.consignors (id) on delete cascade,
  doc_type      text not null,                 -- passport|national_id|driver_license|company_reg|other
  doc_number    text,
  doc_country   text,
  status        text not null default 'pending', -- pending|verified|rejected|expired
  expires_at    date,
  notes         text,
  verified_by   uuid references public.profiles (id),
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists client_kyc_consignor_idx on public.client_kyc (consignor_id);

drop trigger if exists client_kyc_set_updated_at on public.client_kyc;
create trigger client_kyc_set_updated_at
  before update on public.client_kyc
  for each row execute function public.set_updated_at();

alter table public.client_kyc enable row level security;

drop policy if exists "client_kyc_select" on public.client_kyc;
create policy "client_kyc_select" on public.client_kyc
  for select to authenticated using (true);
drop policy if exists "client_kyc_insert" on public.client_kyc;
create policy "client_kyc_insert" on public.client_kyc
  for insert to authenticated with check (true);
drop policy if exists "client_kyc_update" on public.client_kyc;
create policy "client_kyc_update" on public.client_kyc
  for update to authenticated using (true) with check (true);
drop policy if exists "client_kyc_delete" on public.client_kyc;
create policy "client_kyc_delete" on public.client_kyc
  for delete to authenticated using (public.is_admin());

notify pgrst, 'reload config';
