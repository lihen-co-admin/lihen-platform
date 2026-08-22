-- CORE 08/10/11: canonical event store + outbox foundation.
-- No historical events are invented or backfilled by this migration.

create table if not exists public.domain_events (
  id uuid primary key,
  event_type text not null check (length(btrim(event_type)) > 0),
  aggregate_type text not null check (length(btrim(aggregate_type)) > 0),
  aggregate_id uuid not null,
  occurred_at timestamptz not null,
  actor_id uuid null references auth.users(id) on delete set null,
  correlation_id uuid null,
  causation_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists domain_events_aggregate_idx
  on public.domain_events(aggregate_type, aggregate_id, occurred_at, id);
create index if not exists domain_events_type_idx
  on public.domain_events(event_type, occurred_at, id);
create index if not exists domain_events_correlation_idx
  on public.domain_events(correlation_id) where correlation_id is not null;

alter table public.domain_events enable row level security;
revoke all on public.domain_events from anon, authenticated;
grant select on public.domain_events to authenticated;

create policy domain_events_admin_read
  on public.domain_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.authorization_status = 'ACTIVE'
        and p.role_code in ('OWNER', 'ADMIN')
    )
  );

create table if not exists lihen_private.domain_event_outbox (
  event_id uuid primary key references public.domain_events(id) on delete restrict,
  delivery_status text not null default 'PENDING'
    check (delivery_status in ('PENDING', 'PUBLISHED', 'FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  published_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on lihen_private.domain_event_outbox from public, anon, authenticated;
grant all on lihen_private.domain_event_outbox to service_role;

create or replace function lihen_private.append_domain_event(
  p_id uuid,
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_occurred_at timestamptz,
  p_actor_id uuid,
  p_correlation_id uuid,
  p_causation_id uuid,
  p_payload jsonb,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null or p_aggregate_id is null then
    raise exception using errcode = '22023', message = 'LIHEN_DOMAIN_EVENT_ID_REQUIRED';
  end if;
  if p_event_type is null or length(btrim(p_event_type)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_DOMAIN_EVENT_TYPE_REQUIRED';
  end if;
  if p_aggregate_type is null or length(btrim(p_aggregate_type)) = 0 then
    raise exception using errcode = '22023', message = 'LIHEN_DOMAIN_EVENT_AGGREGATE_TYPE_REQUIRED';
  end if;

  insert into public.domain_events(
    id, event_type, aggregate_type, aggregate_id, occurred_at,
    actor_id, correlation_id, causation_id, payload, metadata
  ) values (
    p_id, btrim(p_event_type), btrim(p_aggregate_type), p_aggregate_id,
    coalesce(p_occurred_at, now()), p_actor_id, p_correlation_id, p_causation_id,
    coalesce(p_payload, '{}'::jsonb), coalesce(p_metadata, '{}'::jsonb)
  );

  insert into lihen_private.domain_event_outbox(event_id) values (p_id);
  return p_id;
end;
$$;

revoke all on function lihen_private.append_domain_event(uuid,text,text,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function lihen_private.append_domain_event(uuid,text,text,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb)
  to service_role;

create or replace function lihen_private.prevent_domain_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'LIHEN_DOMAIN_EVENTS_ARE_IMMUTABLE';
end;
$$;

drop trigger if exists domain_events_immutable on public.domain_events;
create trigger domain_events_immutable
before update or delete on public.domain_events
for each row execute function lihen_private.prevent_domain_event_mutation();
