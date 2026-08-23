revoke all on function public.stage_product_import_candidates_dev(text,uuid,jsonb) from public,anon,authenticated;
drop function if exists public.stage_product_import_candidates_dev(text,uuid,jsonb);
drop table if exists lihen_private.product_candidate_staging_ingest_tokens;
revoke all on function lihen_private.stage_product_candidate_lines(uuid,text) from public,anon,authenticated;
drop function if exists lihen_private.stage_product_candidate_lines(uuid,text);
