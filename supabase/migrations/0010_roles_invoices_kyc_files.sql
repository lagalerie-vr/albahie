-- ============================================================================
-- 0010_roles_invoices_kyc_files.sql
--   1. KYC document files (private storage bucket + file_path column)
--   2. Custom roles with per-module CRUD permissions (app-layer RBAC)
--   3. Invoices (auto-created when a lot is sold) + mock payment settlement
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. KYC document files
-- ---------------------------------------------------------------------------
alter table public.client_kyc add column if not exists file_path text;

insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

drop policy if exists "kyc_objects_read"   on storage.objects;
drop policy if exists "kyc_objects_insert" on storage.objects;
drop policy if exists "kyc_objects_delete" on storage.objects;
create policy "kyc_objects_read" on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents');
create policy "kyc_objects_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents');
create policy "kyc_objects_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'kyc-documents');

-- ---------------------------------------------------------------------------
-- 2. Custom roles (app-layer RBAC). permissions shape:
--    { "<moduleKey>": { "c": bool, "r": bool, "u": bool, "d": bool }, ... }
-- ---------------------------------------------------------------------------
create table if not exists public.app_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists app_roles_set_updated_at on public.app_roles;
create trigger app_roles_set_updated_at before update on public.app_roles
  for each row execute function public.set_updated_at();

alter table public.app_roles enable row level security;
drop policy if exists "app_roles_select" on public.app_roles;
create policy "app_roles_select" on public.app_roles for select to authenticated using (true);
drop policy if exists "app_roles_admin" on public.app_roles;
create policy "app_roles_admin" on public.app_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.profiles add column if not exists role_id uuid references public.app_roles (id);

-- ---------------------------------------------------------------------------
-- 3. Invoices
-- ---------------------------------------------------------------------------
create sequence if not exists public.invoice_seq;

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_number  text unique,
  auction_id      uuid,
  lot_id          uuid,
  registration_id uuid,
  client_id       uuid references public.consignors (id),
  buyer_name      text,
  paddle_no       int,
  lot_title       text,
  hammer_cents    bigint not null,
  premium_cents   bigint not null default 0,
  total_cents     bigint not null,
  status          text   not null default 'unpaid',  -- unpaid | settled
  payment_link    text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists invoices_status_idx on public.invoices (status);
create unique index if not exists invoices_lot_uniq on public.invoices (lot_id);

create or replace function public.set_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.invoice_number is null then
    new.invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.invoice_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_set_number on public.invoices;
create trigger invoices_set_number before insert on public.invoices
  for each row execute function public.set_invoice_number();
drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;
drop policy if exists "invoices_select" on public.invoices;
create policy "invoices_select" on public.invoices for select to authenticated using (true);
drop policy if exists "invoices_write" on public.invoices;
create policy "invoices_write" on public.invoices for all to authenticated using (true) with check (true);

notify pgrst, 'reload config';
