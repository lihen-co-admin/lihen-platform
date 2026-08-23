create table if not exists lihen_private.product_candidate_staging_ingest_tokens (
  token_hash text primary key,
  run_id uuid not null references lihen_private.product_import_candidate_runs(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint product_candidate_staging_token_hash_check check (token_hash ~ '^[0-9a-f]{32}$')
);
revoke all on table lihen_private.product_candidate_staging_ingest_tokens from public, anon, authenticated;

create or replace function public.stage_product_import_candidates_dev(
  p_token text,
  p_run_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload_count integer;
  v_inserted integer;
  v_total integer;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception using errcode='42501', message='LIHEN_STAGING_TOKEN_REQUIRED';
  end if;
  if not exists (
    select 1
    from lihen_private.product_candidate_staging_ingest_tokens t
    where t.token_hash = md5(p_token)
      and t.run_id = p_run_id
      and t.revoked_at is null
      and t.expires_at > now()
  ) then
    raise exception using errcode='42501', message='LIHEN_STAGING_TOKEN_INVALID';
  end if;
  if jsonb_typeof(p_payload) <> 'array' then
    raise exception using errcode='22023', message='LIHEN_STAGING_PAYLOAD_ARRAY_REQUIRED';
  end if;
  v_payload_count := jsonb_array_length(p_payload);
  if v_payload_count < 1 or v_payload_count > 200 then
    raise exception using errcode='22023', message='LIHEN_STAGING_PAYLOAD_SIZE_INVALID';
  end if;

  insert into lihen_private.product_import_candidates (
    run_id, source_reference_id, source_page, source_slot, product_name, normalized_name,
    sku, catalog_code, brand_id, category_id, sale_price, image_sha256,
    status, proposed_action, identity_group_size, reasons, supplier_evidence, auto_insert_allowed
  )
  select
    p_run_id,
    x->>'candidate_id',
    (x->>'source_page')::integer,
    x->>'source_slot',
    x->>'product_name',
    x->>'normalized_name',
    nullif(x->>'sku',''),
    nullif(x->>'catalog_code',''),
    nullif(x->>'brand_id','')::uuid,
    nullif(x->>'category_id','')::uuid,
    (x->>'sale_price_cop')::numeric,
    nullif(x->>'image_sha256',''),
    x->>'candidate_status',
    x->>'proposed_action',
    coalesce((x->>'identity_group_size')::integer,1),
    coalesce(x->'reasons','[]'::jsonb),
    coalesce(x->'supplier_evidence','[]'::jsonb),
    false
  from jsonb_array_elements(p_payload) x
  on conflict (run_id, source_reference_id) do nothing;
  get diagnostics v_inserted = row_count;

  select count(*) into v_total
  from lihen_private.product_import_candidates c
  where c.run_id = p_run_id;

  return jsonb_build_object(
    'payload_count', v_payload_count,
    'inserted', v_inserted,
    'run_total', v_total
  );
end;
$$;

revoke all on function public.stage_product_import_candidates_dev(text,uuid,jsonb) from public;
grant execute on function public.stage_product_import_candidates_dev(text,uuid,jsonb) to anon;
