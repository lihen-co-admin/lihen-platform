-- PENDING CUTOVER ONLY — DO NOT APPLY IN FASE 1.16.
-- This enables ONLY controlled product-image METADATA RPCs.
-- Supabase Storage bucket creation/uploads/policies remain disabled and are NOT part of this file.
-- Preconditions:
--   1) real GitHub/JWT probe PASS
--   2) OWNER/ADMIN + ACTIVE authorization probe PASS
--   3) FASE 1.16 RPC/permission probes PASS
--   4) explicit approval to enable image metadata writes in DEV

grant execute
on function public.add_product_image_controlled(text, uuid, uuid, text, text, boolean)
to authenticated;

grant execute
on function public.set_main_product_image_controlled(text, uuid, uuid)
to authenticated;
