-- ============================================================================
-- 0003_appraisal.sql
-- Appraisal module: the manager decision stage (accept / reject / extend).
-- Every awaiting/extended item always carries a forced next date.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Decision type
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'appraisal_action') then
    create type public.appraisal_action as enum ('extended', 'accepted', 'rejected');
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- Decision summary fields on the item
-- ---------------------------------------------------------------------------
alter table public.consignment_items
  add column if not exists appraisal_decided_at timestamptz,
  add column if not exists appraisal_decided_by uuid references public.profiles (id),
  add column if not exists decline_reason text,
  add column if not exists extension_count int not null default 0;

-- ---------------------------------------------------------------------------
-- Full audit trail of appraisal decisions / extensions
-- ---------------------------------------------------------------------------
create table if not exists public.appraisal_events (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.consignment_items (id) on delete cascade,
  action          public.appraisal_action not null,
  decided_by      uuid references public.profiles (id),
  note            text,
  extension_weeks int,
  previous_due_at timestamptz,
  new_due_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists appraisal_events_item_idx
  on public.appraisal_events (item_id);

-- ---------------------------------------------------------------------------
-- RLS: authenticated staff can read and add events; events are immutable.
-- ---------------------------------------------------------------------------
alter table public.appraisal_events enable row level security;

drop policy if exists "appraisal_events_select" on public.appraisal_events;
create policy "appraisal_events_select"
  on public.appraisal_events for select to authenticated using (true);

drop policy if exists "appraisal_events_insert" on public.appraisal_events;
create policy "appraisal_events_insert"
  on public.appraisal_events for insert to authenticated with check (true);
