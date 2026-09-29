-- SOCIAL-OPS-01
-- Durable authority for an already atomically claimed scheduled publication.
-- No cron installation. No scheduler activation. No parallel jobs table.

create or replace function public.get_marketing_scheduled_execution_authority_server_controlled(
  p_actor_id uuid,
  p_prepared_publication_id uuid,
  p_attempt_id uuid,
  p_now timestamptz
)
returns table (
  publication_id uuid,
  attempt_id uuid,
  product_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_actor_id is null
     or p_prepared_publication_id is null
     or p_attempt_id is null
     or p_now is null then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_MARKETING_SOCIAL_SCHEDULED_AUTHORITY_ARGUMENT_REQUIRED';
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
      message = 'LIHEN_MARKETING_SOCIAL_SCHEDULED_AUTHORITY_FORBIDDEN';
  end if;

  return query
  select
    pp.id,
    pa.id,
    coalesce(pi.product_id, va.product_id)
  from public.marketing_prepared_publications pp
  join public.marketing_content_schedules s
    on s.id = pp.schedule_id
  join public.marketing_publication_attempts pa
    on pa.prepared_publication_id = pp.id
  left join public.product_images pi
    on pi.id = pp.creative_asset_ids[1]
   and pi.status = 'ACTIVE'
  left join public.marketing_editorial_video_assets va
    on va.id = pp.creative_asset_ids[1]
   and va.status = 'ACTIVE'
  where pp.id = p_prepared_publication_id
    and pa.id = p_attempt_id
    and pp.status = 'APPROVED'
    and s.status = 'APPROVED'
    and s.scheduled_for <= p_now
    and pa.status = 'PENDING'
    and coalesce(pi.product_id, va.product_id) is not null
    and (
      (pi.id is not null and va.id is null)
      or
      (pi.id is null and va.id is not null)
    )
  limit 1;
end;
$function$;

revoke all
on function public.get_marketing_scheduled_execution_authority_server_controlled(
  uuid, uuid, uuid, timestamptz
)
from public, anon, authenticated;

grant execute
on function public.get_marketing_scheduled_execution_authority_server_controlled(
  uuid, uuid, uuid, timestamptz
)
to service_role;

-- Atomic scheduled START.
-- Revalidates durable scheduling authority and transitions the exact claimed
-- attempt from PENDING to IN_PROGRESS in the same database transaction.
create or replace function public.start_marketing_scheduled_publication_attempt_server_controlled(
  p_actor_id uuid,
  p_operation_key text,
  p_prepared_publication_id uuid,
  p_attempt_id uuid,
  p_now timestamptz
)
returns setof public.marketing_publication_attempts
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_product_id uuid;
begin
  if p_actor_id is null
     or p_prepared_publication_id is null
     or p_attempt_id is null
     or p_now is null then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_MARKETING_SOCIAL_SCHEDULED_START_ARGUMENT_REQUIRED';
  end if;

  if p_operation_key is null
     or length(btrim(p_operation_key)) = 0 then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_OPERATION_KEY_REQUIRED';
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
      message = 'LIHEN_MARKETING_SOCIAL_SCHEDULED_AUTHORITY_FORBIDDEN';
  end if;

  -- Lock the exact claimed attempt first. Authority is then checked against
  -- the same row while the lock remains held through the START transition.
  perform 1
  from public.marketing_publication_attempts pa
  where pa.id = p_attempt_id
    and pa.prepared_publication_id = p_prepared_publication_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'LIHEN_MARKETING_SOCIAL_SCHEDULED_ATTEMPT_NOT_FOUND';
  end if;

  select coalesce(pi.product_id, va.product_id)
  into v_product_id
  from public.marketing_prepared_publications pp
  join public.marketing_content_schedules s
    on s.id = pp.schedule_id
  join public.marketing_publication_attempts pa
    on pa.prepared_publication_id = pp.id
   and pa.id = p_attempt_id
  left join public.product_images pi
    on pi.id = pp.creative_asset_ids[1]
   and pi.status = 'ACTIVE'
  left join public.marketing_editorial_video_assets va
    on va.id = pp.creative_asset_ids[1]
   and va.status = 'ACTIVE'
  where pp.id = p_prepared_publication_id
    and pp.status = 'APPROVED'
    and s.status = 'APPROVED'
    and s.scheduled_for <= p_now
    and pa.status = 'PENDING'
    and coalesce(pi.product_id, va.product_id) is not null
    and (
      (pi.id is not null and va.id is null)
      or
      (pi.id is null and va.id is not null)
    )
  limit 1;

  if v_product_id is null then
    raise exception using
      errcode = '23514',
      message = 'LIHEN_MARKETING_SOCIAL_SCHEDULED_AUTHORITY_REVOKED';
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);

  return query
  select *
  from public.start_marketing_publication_attempt_controlled(
    p_operation_key,
    p_attempt_id
  );
end;
$function$;

revoke all
on function public.start_marketing_scheduled_publication_attempt_server_controlled(
  uuid, text, uuid, uuid, timestamptz
)
from public, anon, authenticated;

grant execute
on function public.start_marketing_scheduled_publication_attempt_server_controlled(
  uuid, text, uuid, uuid, timestamptz
)
to service_role;
