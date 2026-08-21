-- FASE 1.21.2 — PRODUCT CANDIDATE REVIEW RESOLUTION FOUNDATION
-- Applied to DEV as migration 20260821173232.

create table if not exists lihen_private.product_candidate_identity_resolutions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  identity_key text not null,
  resolution text not null check (resolution in ('DISTINCT_PRODUCTS','DUPLICATE_REFERENCE','VARIANT_SET','DEFER')),
  canonical_source_reference_id text null,
  reason text not null check (length(btrim(reason))>0),
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  check ((resolution='DUPLICATE_REFERENCE' and canonical_source_reference_id is not null)
      or (resolution<>'DUPLICATE_REFERENCE' and canonical_source_reference_id is null))
);

create index if not exists product_candidate_identity_resolutions_run_identity_idx
  on lihen_private.product_candidate_identity_resolutions(run_id,identity_key,decided_at desc);

create table if not exists lihen_private.product_candidate_review_operations (
  operation_key text primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  run_id uuid not null,
  source_reference_id text null,
  identity_key text null,
  operation_type text not null check (operation_type in ('CANDIDATE_DECISION','IDENTITY_RESOLUTION')),
  request_fingerprint text not null,
  status text not null check (status='COMPLETED'),
  result_snapshot jsonb not null,
  completed_at timestamptz not null default now(),
  check ((operation_type='CANDIDATE_DECISION' and source_reference_id is not null and identity_key is null)
      or (operation_type='IDENTITY_RESOLUTION' and identity_key is not null and source_reference_id is null))
);

revoke all on lihen_private.product_candidate_identity_resolutions from public, anon, authenticated;
revoke all on lihen_private.product_candidate_review_operations from public, anon, authenticated;

create or replace view lihen_private.product_candidate_identity_groups as
select c.run_id,
  md5(concat_ws('|',c.normalized_name,coalesce(c.brand_id::text,''),coalesce(c.category_id::text,''))) as identity_key,
  c.normalized_name,c.brand_id,c.category_id,
  count(*)::int as member_count,
  array_agg(c.source_reference_id order by c.source_page,c.source_slot) as source_reference_ids,
  array_agg(c.product_name order by c.source_page,c.source_slot) as product_names,
  array_agg(c.sale_price order by c.source_page,c.source_slot) as sale_prices,
  array_agg(c.image_sha256 order by c.source_page,c.source_slot) as image_sha256s
from lihen_private.product_import_candidates c
where c.status='CONFLICT'
group by c.run_id,c.normalized_name,c.brand_id,c.category_id;

create or replace view lihen_private.product_candidate_review_resolution_queue as
select q.*,
  md5(concat_ws('|',q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,''))) as identity_key,
  g.member_count as conflict_group_size,
  lr.resolution as latest_identity_resolution,
  lr.canonical_source_reference_id,
  lr.decided_at as identity_resolved_at,
  ld.decision as latest_candidate_decision,
  ld.selected_product_id,
  ld.decided_at as candidate_decided_at
from lihen_private.product_import_candidate_review_queue q
left join lihen_private.product_candidate_identity_groups g
  on g.run_id=q.run_id
 and g.identity_key=md5(concat_ws('|',q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,'')))
left join lateral (
  select r.resolution,r.canonical_source_reference_id,r.decided_at
  from lihen_private.product_candidate_identity_resolutions r
  where r.run_id=q.run_id
    and r.identity_key=md5(concat_ws('|',q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,'')))
  order by r.decided_at desc limit 1
) lr on true
left join lateral (
  select d.decision,d.selected_product_id,d.decided_at
  from lihen_private.product_import_candidate_reviews d
  where d.run_id=q.run_id and d.source_reference_id=q.source_reference_id
  order by d.decided_at desc limit 1
) ld on true;

revoke all on lihen_private.product_candidate_identity_groups from public, anon, authenticated;
revoke all on lihen_private.product_candidate_review_resolution_queue from public, anon, authenticated;

create or replace function public.record_product_candidate_decision_controlled(
  p_operation_key text,p_run_id uuid,p_source_reference_id text,p_decision text,
  p_selected_product_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_actor uuid:=auth.uid();
  v_existing lihen_private.product_candidate_review_operations%rowtype;
  v_candidate lihen_private.product_import_candidates%rowtype;
  v_fingerprint text; v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PRODUCT_REVIEW_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_decision not in ('APPROVE_CREATE','LINK_EXISTING_PRODUCT','REJECT','DEFER') then raise exception using errcode='22023',message='LIHEN_REVIEW_DECISION_INVALID'; end if;
  if p_reason is null or length(btrim(p_reason))=0 then raise exception using errcode='22023',message='LIHEN_REVIEW_REASON_REQUIRED'; end if;
  if (p_decision='LINK_EXISTING_PRODUCT') <> (p_selected_product_id is not null) then raise exception using errcode='22023',message='LIHEN_SELECTED_PRODUCT_DECISION_MISMATCH'; end if;
  select * into v_candidate from lihen_private.product_import_candidates c where c.run_id=p_run_id and c.source_reference_id=p_source_reference_id;
  if not found or v_candidate.status not in ('CONFLICT','REVIEW_REQUIRED') then raise exception using errcode='22023',message='LIHEN_REVIEW_CANDIDATE_NOT_ELIGIBLE'; end if;
  if p_selected_product_id is not null and not exists(select 1 from public.products p where p.id=p_selected_product_id) then raise exception using errcode='23503',message='LIHEN_SELECTED_PRODUCT_NOT_FOUND'; end if;
  v_fingerprint:=md5(concat_ws('|',p_run_id::text,p_source_reference_id,p_decision,coalesce(p_selected_product_id::text,''),btrim(p_reason)));
  select * into v_existing from lihen_private.product_candidate_review_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.actor_id<>v_actor or v_existing.operation_type<>'CANDIDATE_DECISION' or v_existing.run_id<>p_run_id or v_existing.source_reference_id<>p_source_reference_id or v_existing.request_fingerprint<>v_fingerprint then raise exception using errcode='23505',message='LIHEN_PRODUCT_REVIEW_OPERATION_CONFLICT'; end if;
    return v_existing.result_snapshot;
  end if;
  insert into lihen_private.product_import_candidate_reviews(run_id,source_reference_id,decision,selected_product_id,reason,decided_by)
  values(p_run_id,p_source_reference_id,p_decision,p_selected_product_id,btrim(p_reason),v_actor);
  v_result:=jsonb_build_object('run_id',p_run_id,'source_reference_id',p_source_reference_id,'decision',p_decision,'selected_product_id',p_selected_product_id,'decided_by',v_actor,'decided_at',now());
  insert into lihen_private.product_candidate_review_operations(operation_key,actor_id,run_id,source_reference_id,operation_type,request_fingerprint,status,result_snapshot)
  values(btrim(p_operation_key),v_actor,p_run_id,p_source_reference_id,'CANDIDATE_DECISION',v_fingerprint,'COMPLETED',v_result);
  return v_result;
end;$function$;

create or replace function public.record_product_identity_resolution_controlled(
  p_operation_key text,p_run_id uuid,p_identity_key text,p_resolution text,
  p_canonical_source_reference_id text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_actor uuid:=auth.uid();
  v_existing lihen_private.product_candidate_review_operations%rowtype;
  v_group lihen_private.product_candidate_identity_groups%rowtype;
  v_fingerprint text; v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PRODUCT_REVIEW_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_resolution not in ('DISTINCT_PRODUCTS','DUPLICATE_REFERENCE','VARIANT_SET','DEFER') then raise exception using errcode='22023',message='LIHEN_IDENTITY_RESOLUTION_INVALID'; end if;
  if p_reason is null or length(btrim(p_reason))=0 then raise exception using errcode='22023',message='LIHEN_REVIEW_REASON_REQUIRED'; end if;
  if (p_resolution='DUPLICATE_REFERENCE') <> (p_canonical_source_reference_id is not null) then raise exception using errcode='22023',message='LIHEN_CANONICAL_REFERENCE_RESOLUTION_MISMATCH'; end if;
  select * into v_group from lihen_private.product_candidate_identity_groups g where g.run_id=p_run_id and g.identity_key=p_identity_key;
  if not found then raise exception using errcode='22023',message='LIHEN_IDENTITY_GROUP_NOT_FOUND'; end if;
  if p_canonical_source_reference_id is not null and not (p_canonical_source_reference_id=any(v_group.source_reference_ids)) then raise exception using errcode='22023',message='LIHEN_CANONICAL_REFERENCE_NOT_IN_GROUP'; end if;
  v_fingerprint:=md5(concat_ws('|',p_run_id::text,p_identity_key,p_resolution,coalesce(p_canonical_source_reference_id,''),btrim(p_reason)));
  select * into v_existing from lihen_private.product_candidate_review_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.actor_id<>v_actor or v_existing.operation_type<>'IDENTITY_RESOLUTION' or v_existing.run_id<>p_run_id or v_existing.identity_key<>p_identity_key or v_existing.request_fingerprint<>v_fingerprint then raise exception using errcode='23505',message='LIHEN_PRODUCT_REVIEW_OPERATION_CONFLICT'; end if;
    return v_existing.result_snapshot;
  end if;
  insert into lihen_private.product_candidate_identity_resolutions(run_id,identity_key,resolution,canonical_source_reference_id,reason,decided_by)
  values(p_run_id,p_identity_key,p_resolution,p_canonical_source_reference_id,btrim(p_reason),v_actor);
  v_result:=jsonb_build_object('run_id',p_run_id,'identity_key',p_identity_key,'resolution',p_resolution,'canonical_source_reference_id',p_canonical_source_reference_id,'decided_by',v_actor,'decided_at',now());
  insert into lihen_private.product_candidate_review_operations(operation_key,actor_id,run_id,identity_key,operation_type,request_fingerprint,status,result_snapshot)
  values(btrim(p_operation_key),v_actor,p_run_id,p_identity_key,'IDENTITY_RESOLUTION',v_fingerprint,'COMPLETED',v_result);
  return v_result;
end;$function$;

revoke all on function public.record_product_candidate_decision_controlled(text,uuid,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.record_product_identity_resolution_controlled(text,uuid,text,text,text,text) from public,anon,authenticated;
