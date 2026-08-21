-- FASE 1.20.3 — fixes idempotency discovered during the DEV cutover.
-- Existing completed operations are resolved by immutable request identity
-- (operation_key + actor_id + run_id) before re-running the mutable preview.
create or replace function public.import_approved_taxonomy_controlled(p_operation_key text, p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_fingerprint text;
  v_existing lihen_private.taxonomy_import_operations%rowtype;
  v_preview_count integer;
  v_ready_count integer;
  v_existing_count integer;
  v_conflict_count integer;
  v_brand_created integer := 0;
  v_category_created integer := 0;
  v_result jsonb;
begin
  if v_actor_id is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then raise exception using errcode='42501', message='LIHEN_TAXONOMY_IMPORT_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_run_id is null then raise exception using errcode='22023', message='LIHEN_TAXONOMY_RUN_ID_REQUIRED'; end if;
  if not exists (
    select 1 from lihen_private.taxonomy_reconciliation_runs r
    where r.id=p_run_id and r.status='COMPLETED'
  ) then raise exception using errcode='22023', message='LIHEN_TAXONOMY_RUN_NOT_COMPLETED'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('LIHEN_TAXONOMY_IMPORT',0));

  select o.* into v_existing
  from lihen_private.taxonomy_import_operations o
  where o.operation_key=btrim(p_operation_key);

  if found then
    if v_existing.actor_id<>v_actor_id or v_existing.run_id<>p_run_id or v_existing.status<>'COMPLETED' then
      raise exception using errcode='23505', message='LIHEN_TAXONOMY_IMPORT_OPERATION_CONFLICT';
    end if;
    return v_existing.result_snapshot;
  end if;

  select count(*),
         count(*) filter(where p.import_status='READY_CREATE'),
         count(*) filter(where p.import_status='ALREADY_EXISTS'),
         count(*) filter(where p.import_status like 'CONFLICT%')
  into v_preview_count,v_ready_count,v_existing_count,v_conflict_count
  from lihen_private.preview_taxonomy_import(p_run_id) p;

  if v_preview_count=0 then raise exception using errcode='22023', message='LIHEN_TAXONOMY_IMPORT_NO_APPROVED_ENTITIES'; end if;
  if v_conflict_count>0 then raise exception using errcode='23505', message='LIHEN_TAXONOMY_IMPORT_CONFLICT_REVIEW_REQUIRED'; end if;

  v_fingerprint:=md5(p_run_id::text);

  insert into public.brands(name,normalized_name,status)
  select p.canonical_name,p.normalized_name,'ACTIVE'
  from lihen_private.preview_taxonomy_import(p_run_id) p
  where p.entity_type='BRAND' and p.import_status='READY_CREATE';
  get diagnostics v_brand_created=row_count;

  insert into public.categories(name,normalized_name,slug,business_line,parent_id,status,sort_order)
  select p.canonical_name,p.normalized_name,lihen_private.taxonomy_slug(p.canonical_name),null,null,'ACTIVE',
         row_number() over(order by p.source_page nulls last,p.canonical_name)::integer-1
  from lihen_private.preview_taxonomy_import(p_run_id) p
  where p.entity_type='CATEGORY' and p.import_status='READY_CREATE';
  get diagnostics v_category_created=row_count;

  v_result:=jsonb_build_object(
    'run_id',p_run_id,
    'preview_count',v_preview_count,
    'already_existing',v_existing_count,
    'brands_created',v_brand_created,
    'categories_created',v_category_created,
    'completed_at',now()
  );

  insert into lihen_private.taxonomy_import_operations(
    operation_key,actor_id,run_id,request_fingerprint,status,result_snapshot,completed_at
  ) values(
    btrim(p_operation_key),v_actor_id,p_run_id,v_fingerprint,'COMPLETED',v_result,now()
  );

  return v_result;
end;
$function$;
