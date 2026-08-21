-- CUTOVER PENDING — DO NOT APPLY until all gates are green:
-- 1) real GitHub JWT probe PASS
-- 2) first account promoted to OWNER/ADMIN + ACTIVE
-- 3) FASE 1.10 authorization/RPC probes PASS
-- 4) explicit approval to enable CreateProduct in DEV

grant execute on function public.create_product_controlled(text, uuid, text, text, text, uuid, uuid, text, numeric)
  to authenticated;
