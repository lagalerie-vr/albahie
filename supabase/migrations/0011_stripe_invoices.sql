-- ============================================================================
-- 0011_stripe_invoices.sql
-- Link our invoices to Stripe Invoicing objects so payment is taken through
-- Stripe (test mode supported). The local invoice remains the source of truth
-- for the ERP; Stripe owns the hosted payment page + payment status.
-- ============================================================================

alter table public.invoices
  add column if not exists stripe_invoice_id  text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_status      text;

notify pgrst, 'reload config';
