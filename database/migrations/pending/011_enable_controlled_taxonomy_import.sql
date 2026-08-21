-- FUTURE CUTOVER ONLY — DO NOT APPLY DURING FASE 1.20.2.
-- Enable only after explicit approval of the taxonomy import dry-run.
grant execute on function public.import_approved_taxonomy_controlled(text, uuid) to authenticated;
