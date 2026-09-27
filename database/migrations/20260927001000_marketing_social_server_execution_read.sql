create or replace function public.get_marketing_publication_execution_server_controlled(
  p_actor_id uuid,
  p_attempt_id uuid,
  p_prepared_publication_id uuid
)
returns table (
  publication_id uuid,
  channel text,
  copy text,
  cta text,
  hashtags text[],
  creative_asset_ids uuid[],
  publication_status text,
  attempt_id uuid,
  prepared_publication_id uuid,
  attempt_status text
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_actor_id
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN')
  ) then
    raise exception using
      errcode = '42501',
      message = 'LIHEN_MARKETING_SOCIAL_SERVER_EXECUTION_FORBIDDEN';
  end if;

  return query
  select
    pp.id,
    pp.channel,
    pp.copy,
    pp.cta,
    pp.hashtags,
    pp.creative_asset_ids,
    pp.status,
    pa.id,
    pa.prepared_publication_id,
    pa.status
  from public.marketing_prepared_publications pp
  join public.marketing_publication_attempts pa
    on pa.prepared_publication_id = pp.id
  where pp.id = p_prepared_publication_id
    and pa.id = p_attempt_id;
end;
$function$;

revoke all on function
  public.get_marketing_publication_execution_server_controlled(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function
  public.get_marketing_publication_execution_server_controlled(uuid, uuid, uuid)
  to service_role;
