-- FASE 1.21.2 hardening: identity resolution applies only to actual multi-member groups.
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
  if v_group.member_count<=1 then raise exception using errcode='22023',message='LIHEN_IDENTITY_GROUP_REQUIRES_MULTIPLE_MEMBERS'; end if;
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
revoke all on function public.record_product_identity_resolution_controlled(text,uuid,text,text,text,text) from public,anon,authenticated;
