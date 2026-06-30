-- ============================================================================
-- 0007_participant_clients.sql
-- Auction participants are Clients (public.consignors), added by staff — not
-- necessarily platform logins. Online self-registration (user_id) still works.
-- ============================================================================

alter table auction.registrations
  alter column user_id drop not null;

alter table auction.registrations
  add column if not exists client_id uuid references public.consignors (id) on delete cascade;

-- One registration per client per auction (NULLs allowed for online bidders).
create unique index if not exists registrations_auction_client_uniq
  on auction.registrations (auction_id, client_id)
  where client_id is not null;

notify pgrst, 'reload config';
