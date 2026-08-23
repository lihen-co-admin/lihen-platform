create or replace function lihen_private.stage_product_candidate_lines(p_run_id uuid, p_lines text)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare v_inserted integer;
begin
  insert into lihen_private.product_import_candidates(
    run_id,source_reference_id,source_page,source_slot,product_name,normalized_name,
    sku,catalog_code,brand_id,category_id,sale_price,image_sha256,status,proposed_action,
    identity_group_size,reasons,supplier_evidence,auto_insert_allowed)
  select p_run_id,v[1],v[2]::int,v[3],v[4],lihen_private.normalize_taxonomy_name(v[4]),
    null,null,nullif(v[5],'')::uuid,nullif(v[6],'')::uuid,v[7]::numeric,null,
    case v[8] when 'R' then 'READY_CANDIDATE' when 'C' then 'CONFLICT' else 'REVIEW_REQUIRED' end,
    case v[8] when 'R' then 'CREATE_PRODUCT' else 'HOLD_FOR_REVIEW' end,
    v[9]::int,
    case v[8] when 'R' then jsonb_build_array('UNIQUE_CATALOG_IDENTITY_WITH_RESOLVED_TAXONOMY')
         when 'C' then jsonb_build_array('DUPLICATE_CATALOG_IDENTITY_REVIEW_REQUIRED')
         else jsonb_build_array('CATALOG_AUDIT_REVIEW_REQUIRED') end,
    '[]'::jsonb,false
  from (
    select string_to_array(line,'|') v
    from string_to_table(p_lines,E'\n') line
    where length(line)>0
  ) s
  on conflict(run_id,source_reference_id) do nothing;
  get diagnostics v_inserted=row_count;
  return v_inserted;
end;$$;
revoke all on function lihen_private.stage_product_candidate_lines(uuid,text) from public,anon,authenticated;
