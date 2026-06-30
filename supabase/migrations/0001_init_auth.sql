-- ============================================================================
-- 0001_init_auth.sql
-- Auth foundation for the Auction House ERP.
-- Run this in the Supabase SQL editor (or via the Supabase CLI).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'staff');
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, holding ERP-specific fields.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.user_role not null default 'staff',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'ERP user profile, 1:1 with auth.users.';

-- Keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile whenever a new auth user is created (e.g. via invite).
-- full_name is read from user metadata if the inviter provided it.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role,
      'staff'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helper: is the current user an admin? (SECURITY DEFINER avoids RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Each user can read their own profile; admins can read everyone.
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- Users can update their own non-privileged fields; admins can update anyone.
-- (Guard against self role-escalation in app logic / future column policies.)
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Only admins can delete profiles.
drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- Inserts happen via the trigger (security definer); no client insert policy
-- is granted, so self-service signup cannot create profiles directly.
