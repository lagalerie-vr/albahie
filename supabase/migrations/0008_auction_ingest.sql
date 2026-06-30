-- ============================================================================
-- 0008_auction_ingest.sql
-- Persist the WHIP ingress per auction so we create it exactly once. Repeated
-- panel loads return the stored creds instead of creating a new ingress object
-- each time (LiveKit Cloud caps the number of ingress objects per project, and
-- listIngress is eventually-consistent, so re-creating piled up duplicates).
-- ============================================================================

alter table auction.auctions
  add column if not exists whip_url        text,
  add column if not exists whip_stream_key text,
  add column if not exists ingress_id      text;

notify pgrst, 'reload config';
