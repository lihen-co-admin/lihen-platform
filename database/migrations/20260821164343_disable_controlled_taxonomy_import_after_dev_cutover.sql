-- FASE 1.20.3 — close the DEV cutover gate after successful import.
revoke execute on function public.import_approved_taxonomy_controlled(text, uuid) from authenticated;
