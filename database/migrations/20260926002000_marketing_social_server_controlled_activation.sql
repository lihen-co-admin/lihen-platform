-- Marketing Social — Server-Controlled DEV Activation Foundation
--
-- Provides a server-only bridge from the authenticated Marketing Edge
-- Function to the existing governed social persistence RPCs.
--
-- DOES NOT:
-- - grant authenticated/anon direct execution
-- - publish to external social providers
-- - start or complete publication attempts
-- - expose service-role credentials to the browser
--
-- The human actor remains explicit and auditable. The existing controlled
-- RPCs continue to own persistence rules, idempotency and state validation.

create or replace function public.save_marketing_content_schedule_server_controlled(
  p_actor_id uuid,
  p_operation_key text,
  p_id uuid,
  p_channel_variant_id uuid,
  p_scheduled_for timestamptz,
  p_timezone text,
  p_status text,
  p_created_at timestamptz,
  p_updated_at timestamptz
)
returns setof public.marketing_content_schedules
language plpgsql
security definer
set search_path = ''
as $$
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
      message = 'LIHEN_MARKETING_SOCIAL_SERVER_WRITE_FORBIDDEN';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    p_actor_id::text,
    true
  );

  return query
  select *
  from public.save_marketing_content_schedule_controlled(
    p_operation_key,
    p_id,
    p_channel_variant_id,
    p_scheduled_for,
    p_timezone,
    p_status,
    p_created_at,
    p_updated_at
  );
end;
$$;

revoke execute on function
  public.save_marketing_content_schedule_server_controlled(
    uuid, text, uuid, uuid, timestamptz, text, text,
    timestamptz, timestamptz
  )
from public, anon, authenticated;

grant execute on function
  public.save_marketing_content_schedule_server_controlled(
    uuid, text, uuid, uuid, timestamptz, text, text,
    timestamptz, timestamptz
  )
to service_role;


create or replace function public.save_marketing_prepared_publication_server_controlled(
  p_actor_id uuid,
  p_operation_key text,
  p_id uuid,
  p_campaign_id uuid,
  p_campaign_content_id uuid,
  p_channel_variant_id uuid,
  p_schedule_id uuid,
  p_channel text,
  p_copy text,
  p_cta text,
  p_hashtags text[],
  p_creative_asset_ids uuid[],
  p_status text,
  p_prepared_at timestamptz
)
returns setof public.marketing_prepared_publications
language plpgsql
security definer
set search_path = ''
as $$
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
      message = 'LIHEN_MARKETING_SOCIAL_SERVER_WRITE_FORBIDDEN';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    p_actor_id::text,
    true
  );

  return query
  select *
  from public.save_marketing_prepared_publication_controlled(
    p_operation_key,
    p_id,
    p_campaign_id,
    p_campaign_content_id,
    p_channel_variant_id,
    p_schedule_id,
    p_channel,
    p_copy,
    p_cta,
    p_hashtags,
    p_creative_asset_ids,
    p_status,
    p_prepared_at
  );
end;
$$;

revoke execute on function
  public.save_marketing_prepared_publication_server_controlled(
    uuid, text, uuid, uuid, uuid, uuid, uuid, text,
    text, text, text[], uuid[], text, timestamptz
  )
from public, anon, authenticated;

grant execute on function
  public.save_marketing_prepared_publication_server_controlled(
    uuid, text, uuid, uuid, uuid, uuid, uuid, text,
    text, text, text[], uuid[], text, timestamptz
  )
to service_role;


create or replace function public.create_marketing_publication_attempt_server_controlled(
  p_actor_id uuid,
  p_operation_key text,
  p_id uuid,
  p_prepared_publication_id uuid
)
returns setof public.marketing_publication_attempts
language plpgsql
security definer
set search_path = ''
as $$
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
      message = 'LIHEN_MARKETING_SOCIAL_SERVER_WRITE_FORBIDDEN';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    p_actor_id::text,
    true
  );

  return query
  select *
  from public.create_marketing_publication_attempt_controlled(
    p_operation_key,
    p_id,
    p_prepared_publication_id
  );
end;
$$;

revoke execute on function
  public.create_marketing_publication_attempt_server_controlled(
    uuid, text, uuid, uuid
  )
from public, anon, authenticated;

grant execute on function
  public.create_marketing_publication_attempt_server_controlled(
    uuid, text, uuid, uuid
  )
to service_role;


comment on function
  public.create_marketing_publication_attempt_server_controlled(
    uuid, text, uuid, uuid
  )
is
  'Server-only bridge for creating a governed PENDING social publication attempt. Performs no external publication or provider execution.';
