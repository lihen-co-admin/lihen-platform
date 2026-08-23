-- FASE 2.4A — RLS read policy correction.
-- The Phase 1 restrictive ALL deny policy also blocked SELECT. Direct writes remain denied
-- by privileges, immutable trigger, and absence of permissive write policies.

drop policy if exists inventory_movements_explicit_deny on public.inventory_movements;

revoke insert, update, delete on table public.inventory_movements from anon, authenticated;
