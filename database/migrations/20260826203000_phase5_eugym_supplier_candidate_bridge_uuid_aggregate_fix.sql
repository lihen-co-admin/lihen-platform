-- LIHEN FASE 5 — EUGYM Supplier Candidate Bridge UUID aggregate compatibility fix
-- Forward-only, non-destructive.
--
-- PostgreSQL does not provide min(uuid) in this environment. The existing
-- controlled bridge used min(uuid) only to select a deterministic representative
-- row after count(*). Replace those UUID aggregates with deterministic array_agg
-- selection without changing the bridge contract or product data.

do $$
declare
  v_sql text;
  v_original text;
begin
  select pg_get_functiondef(
    'public.build_supplier_product_candidates_controlled(text,uuid,text)'::regprocedure
  )
  into v_original;

  v_sql := replace(
    v_original,
    'select count(*), min(p.id), min(p.brand_id), min(p.category_id)',
    'select count(*), (array_agg(p.id order by p.id::text))[1], (array_agg(p.brand_id order by p.brand_id::text) filter (where p.brand_id is not null))[1], (array_agg(p.category_id order by p.category_id::text) filter (where p.category_id is not null))[1]'
  );

  if v_sql = v_original then
    raise exception 'LIHEN_UUID_AGGREGATE_PATCH_TARGET_NOT_FOUND';
  end if;

  execute v_sql;
end;
$$;
