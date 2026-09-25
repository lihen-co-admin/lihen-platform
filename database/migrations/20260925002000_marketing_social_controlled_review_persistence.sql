-- SOCIAL-08 — Marketing Social Controlled Review Persistence Foundation
-- Controlled persistence for human-reviewed schedules/prepared publications only.
-- This migration does NOT enable execution for authenticated users.

create table if not exists lihen_private.marketing_social_write_operations (
  operation_key text primary key,
  operation_type text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  constraint marketing_social_write_operations_key_not_blank
    check (length(btrim(operation_key)) > 0),
  constraint marketing_social_write_operations_type_check
    check (
      operation_type in (
        'SAVE_CONTENT_SCHEDULE',
        'SAVE_PREPARED_PUBLICATION'
      )
    )
);

revoke all
on table lihen_private.marketing_social_write_operations
from public, anon, authenticated;


create or replace function public.save_marketing_content_schedule_controlled(
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
declare
  v_actor_id uuid;
  v_existing_entity_id uuid;
  v_existing_operation_type text;
  v_existing_actor_id uuid;
begin
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN')
  ) then
    raise exception using
      errcode = '42501',
      message = 'LIHEN_MARKETING_SOCIAL_WRITE_FORBIDDEN';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_OPERATION_KEY_REQUIRED';
  end if;

  if p_id is null then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_MARKETING_SOCIAL_ENTITY_ID_REQUIRED';
  end if;

  select o.operation_type, o.actor_id, o.entity_id
    into v_existing_operation_type, v_existing_actor_id, v_existing_entity_id
  from lihen_private.marketing_social_write_operations o
  where o.operation_key = btrim(p_operation_key);

  if v_existing_entity_id is not null then
    if v_existing_operation_type <> 'SAVE_CONTENT_SCHEDULE'
       or v_existing_actor_id <> v_actor_id
       or v_existing_entity_id <> p_id then
      raise exception using
        errcode = '23505',
        message = 'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT';
    end if;

    return query
    select s.*
    from public.marketing_content_schedules s
    where s.id = v_existing_entity_id;
    return;
  end if;

  insert into public.marketing_content_schedules (
    id,
    channel_variant_id,
    scheduled_for,
    timezone,
    status,
    created_at,
    updated_at
  ) values (
    p_id,
    p_channel_variant_id,
    p_scheduled_for,
    p_timezone,
    p_status,
    p_created_at,
    p_updated_at
  )
  on conflict (id) do update set
    channel_variant_id = excluded.channel_variant_id,
    scheduled_for = excluded.scheduled_for,
    timezone = excluded.timezone,
    status = excluded.status,
    updated_at = excluded.updated_at;

  insert into lihen_private.marketing_social_write_operations (
    operation_key,
    operation_type,
    actor_id,
    entity_id
  ) values (
    btrim(p_operation_key),
    'SAVE_CONTENT_SCHEDULE',
    v_actor_id,
    p_id
  );

  return query
  select s.*
  from public.marketing_content_schedules s
  where s.id = p_id;
end;
$$;

revoke execute on function public.save_marketing_content_schedule_controlled(
  text, uuid, uuid, timestamptz, text, text, timestamptz, timestamptz
) from public;
revoke execute on function public.save_marketing_content_schedule_controlled(
  text, uuid, uuid, timestamptz, text, text, timestamptz, timestamptz
) from anon;
revoke execute on function public.save_marketing_content_schedule_controlled(
  text, uuid, uuid, timestamptz, text, text, timestamptz, timestamptz
) from authenticated;


create or replace function public.save_marketing_prepared_publication_controlled(
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
declare
  v_actor_id uuid;
  v_existing_entity_id uuid;
  v_existing_operation_type text;
  v_existing_actor_id uuid;
begin
  v_actor_id := (select auth.uid());

  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN')
  ) then
    raise exception using
      errcode = '42501',
      message = 'LIHEN_MARKETING_SOCIAL_WRITE_FORBIDDEN';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_OPERATION_KEY_REQUIRED';
  end if;

  if p_id is null then
    raise exception using
      errcode = '22023',
      message = 'LIHEN_MARKETING_SOCIAL_ENTITY_ID_REQUIRED';
  end if;

  select o.operation_type, o.actor_id, o.entity_id
    into v_existing_operation_type, v_existing_actor_id, v_existing_entity_id
  from lihen_private.marketing_social_write_operations o
  where o.operation_key = btrim(p_operation_key);

  if v_existing_entity_id is not null then
    if v_existing_operation_type <> 'SAVE_PREPARED_PUBLICATION'
       or v_existing_actor_id <> v_actor_id
       or v_existing_entity_id <> p_id then
      raise exception using
        errcode = '23505',
        message = 'LIHEN_MARKETING_SOCIAL_WRITE_OPERATION_CONFLICT';
    end if;

    return query
    select p.*
    from public.marketing_prepared_publications p
    where p.id = v_existing_entity_id;
    return;
  end if;

  insert into public.marketing_prepared_publications (
    id,
    campaign_id,
    campaign_content_id,
    channel_variant_id,
    schedule_id,
    channel,
    copy,
    cta,
    hashtags,
    creative_asset_ids,
    status,
    prepared_at
  ) values (
    p_id,
    p_campaign_id,
    p_campaign_content_id,
    p_channel_variant_id,
    p_schedule_id,
    p_channel,
    p_copy,
    p_cta,
    coalesce(p_hashtags, '{}'::text[]),
    coalesce(p_creative_asset_ids, '{}'::uuid[]),
    p_status,
    p_prepared_at
  )
  on conflict (id) do update set
    campaign_id = excluded.campaign_id,
    campaign_content_id = excluded.campaign_content_id,
    channel_variant_id = excluded.channel_variant_id,
    schedule_id = excluded.schedule_id,
    channel = excluded.channel,
    copy = excluded.copy,
    cta = excluded.cta,
    hashtags = excluded.hashtags,
    creative_asset_ids = excluded.creative_asset_ids,
    status = excluded.status;

  insert into lihen_private.marketing_social_write_operations (
    operation_key,
    operation_type,
    actor_id,
    entity_id
  ) values (
    btrim(p_operation_key),
    'SAVE_PREPARED_PUBLICATION',
    v_actor_id,
    p_id
  );

  return query
  select publication.*
  from public.marketing_prepared_publications publication
  where publication.id = p_id;
end;
$$;

revoke execute on function public.save_marketing_prepared_publication_controlled(
  text, uuid, uuid, uuid, uuid, uuid, text, text, text, text[], uuid[], text, timestamptz
) from public;
revoke execute on function public.save_marketing_prepared_publication_controlled(
  text, uuid, uuid, uuid, uuid, uuid, text, text, text, text[], uuid[], text, timestamptz
) from anon;
revoke execute on function public.save_marketing_prepared_publication_controlled(
  text, uuid, uuid, uuid, uuid, uuid, text, text, text, text[], uuid[], text, timestamptz
) from authenticated;

-- Direct table mutations remain unavailable to anon/authenticated.
revoke insert, update, delete
on table public.marketing_content_schedules
from anon, authenticated;

revoke insert, update, delete
on table public.marketing_prepared_publications
from anon, authenticated;
