-- FASE 1.12 hardening — explicit fail-closed policy for price history.
-- Keeps the table inaccessible to browser roles while making the RLS posture explicit.

drop policy if exists product_sale_price_history_direct_read_denied
  on public.product_sale_price_history;

create policy product_sale_price_history_direct_read_denied
  on public.product_sale_price_history
  for select
  to authenticated
  using (false);

revoke all on table public.product_sale_price_history from anon, authenticated;
