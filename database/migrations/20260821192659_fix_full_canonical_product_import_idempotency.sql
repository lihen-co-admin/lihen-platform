create or replace function public.import_full_canonical_products_controlled(p_operation_key text, p_import_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_run lihen_private.full_canonical_product_import_runs%rowtype;
  v_existing lihen_private.full_canonical_product_import_operations%rowtype;
  v_total integer; v_ready integer; v_conflicts integer; v_created integer:=0;
  v_human integer; v_policy integer;
  v_fingerprint text; v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_FULL_CANONICAL_PRODUCT_IMPORT_FORBIDDEN';
  end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;

  select * into v_run
  from lihen_private.full_canonical_product_import_runs r
  where r.id=p_import_run_id and r.status='COMPLETED';
  if not found then raise exception using errcode='22023',message='LIHEN_FULL_CANONICAL_IMPORT_RUN_NOT_COMPLETED'; end if;
  if v_run.scope<>'FULL_CANONICAL_APPROVED' then raise exception using errcode='22023',message='LIHEN_FULL_CANONICAL_IMPORT_SCOPE_INVALID'; end if;

  v_fingerprint:=md5(concat_ws('|',
    p_import_run_id::text,
    v_run.canonical_approved_count::text,
    v_run.human_approved_count::text,
    v_run.policy_approved_count::text,
    v_run.strategy_version,
    'FULL_CANONICAL_PRODUCT_IMPORT_V1'
  ));

  select * into v_existing
  from lihen_private.full_canonical_product_import_operations o
  where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.actor_id<>v_actor
       or v_existing.import_run_id<>p_import_run_id
       or v_existing.request_fingerprint<>v_fingerprint then
      raise exception using errcode='23505',message='LIHEN_FULL_CANONICAL_IMPORT_OPERATION_CONFLICT';
    end if;
    return v_existing.result_snapshot;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('LIHEN_FULL_CANONICAL_PRODUCT_IMPORT',0));

  select count(*),
         count(*) filter(where p.import_status='READY_CREATE'),
         count(*) filter(where p.import_status<>'READY_CREATE'),
         count(*) filter(where p.approval_source='HUMAN_APPROVED'),
         count(*) filter(where p.approval_source='POLICY_APPROVED')
  into v_total,v_ready,v_conflicts,v_human,v_policy
  from lihen_private.preview_full_canonical_product_import(p_import_run_id) p;

  if v_total<>v_run.canonical_approved_count
     or v_human<>v_run.human_approved_count
     or v_policy<>v_run.policy_approved_count
     or v_ready<>v_total
     or v_conflicts<>0 then
    raise exception using errcode='23505',message='LIHEN_FULL_CANONICAL_IMPORT_PREVIEW_NOT_READY';
  end if;

  insert into public.products(
    id,sku,catalog_code,slug,name,business_line,brand,category,description,
    sale_price,current_cost,minimum_stock,status,visible_on_website,main_image_url,brand_id,category_id
  )
  select a.proposed_product_id,a.proposed_sku,a.proposed_catalog_code,a.proposed_slug,
         a.product_name,a.business_line,b.name,cat.name,null,
         a.sale_price,null,0,'ACTIVE',false,null,a.brand_id,a.category_id
  from lihen_private.full_canonical_product_import_candidates a
  left join public.brands b on b.id=a.brand_id
  left join public.categories cat on cat.id=a.category_id and cat.business_line=a.business_line
  where a.import_run_id=p_import_run_id and a.eligibility_status='READY_CREATE';
  get diagnostics v_created=row_count;
  if v_created<>v_total then raise exception using errcode='P0001',message='LIHEN_FULL_CANONICAL_IMPORT_CREATE_COUNT_MISMATCH'; end if;

  v_result:=jsonb_build_object(
    'import_run_id',p_import_run_id,
    'scope',v_run.scope,
    'business_line',v_run.business_line,
    'canonical_approved',v_total,
    'human_approved',v_human,
    'policy_approved',v_policy,
    'created_products',v_created,
    'completed_at',now()
  );

  insert into lihen_private.full_canonical_product_import_operations(operation_key,actor_id,import_run_id,request_fingerprint,status,result_snapshot,completed_at)
  values(btrim(p_operation_key),v_actor,p_import_run_id,v_fingerprint,'COMPLETED',v_result,now());

  return v_result;
end;
$function$;

revoke all on function public.import_full_canonical_products_controlled(text,uuid) from public, anon, authenticated;
grant execute on function public.import_full_canonical_products_controlled(text,uuid) to postgres;
