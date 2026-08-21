-- FASE 1.20.3 — temporary DEV cutover enablement.
-- This grant was used only for the controlled DEV import and was revoked afterwards.
grant execute on function public.import_approved_taxonomy_controlled(text, uuid) to authenticated;
