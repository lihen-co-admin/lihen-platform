create or replace function public.get_latest_storefront_visibility_cutover_controlled(p_catalog_version_id uuid)
returns table(
  run_id uuid,
  catalog_version_id uuid,
  status text,
  source_count integer,
  eligible_count integer,
  blocked_count integer,
  already_visible_count integer,
  outside_visible_baseline_count integer,
  affected_count integer,
  verification_metrics jsonb
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor_id uuid:=auth.uid();
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_STOREFRONT_CUTOVER_FORBIDDEN';
  end if;
  return query
  select r.id,r.catalog_version_id,r.status,r.source_count,r.eligible_count,r.blocked_count,r.already_visible_count,r.outside_visible_baseline_count,r.affected_count,r.verification_metrics
  from lihen_private.storefront_visibility_cutover_runs r
  where r.catalog_version_id=p_catalog_version_id
  order by r.created_at desc,r.id desc
  limit 1;
end;
$function$;

revoke all on function public.get_latest_storefront_visibility_cutover_controlled(uuid) from public;
grant execute on function public.get_latest_storefront_visibility_cutover_controlled(uuid) to authenticated;
