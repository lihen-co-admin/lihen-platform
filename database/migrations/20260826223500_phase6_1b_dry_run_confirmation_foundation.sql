create table if not exists lihen_private.control_center_operation_intents (
  intent_id uuid primary key default gen_random_uuid(),
  operation_key text not null unique,
  operation_code text not null references lihen_private.control_center_operation_catalog(operation_code),
  actor_id uuid not null,
  request_payload jsonb not null default '{}'::jsonb,
  request_fingerprint text not null,
  confirmation_token uuid not null default gen_random_uuid(),
  status text not null default 'PREVIEWED' check (status in ('PREVIEWED','CONFIRMED','CANCELLED','EXPIRED')),
  preview_snapshot jsonb not null,
  previewed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_control_center_operation_intents_actor_created
  on lihen_private.control_center_operation_intents(actor_id, created_at desc);
create index if not exists idx_control_center_operation_intents_status_expires
  on lihen_private.control_center_operation_intents(status, expires_at);

revoke all on lihen_private.control_center_operation_intents from public, anon, authenticated;
grant select, insert, update on lihen_private.control_center_operation_intents to postgres;

create or replace function public.prepare_control_center_operation_controlled(
  p_operation_key text,
  p_operation_code text,
  p_request_payload jsonb
)
returns table(
  intent_id uuid,
  operation_key text,
  operation_code text,
  domain_code text,
  risk_level text,
  action_kind text,
  requires_confirmation boolean,
  execution_enabled boolean,
  status text,
  confirmation_token uuid,
  preview_snapshot jsonb,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_catalog lihen_private.control_center_operation_catalog%rowtype;
  v_fingerprint text;
  v_existing lihen_private.control_center_operation_intents%rowtype;
  v_intent lihen_private.control_center_operation_intents%rowtype;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_OPERATION_PREVIEW_FORBIDDEN';
  end if;
  if nullif(btrim(p_operation_key),'') is null then
    raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED';
  end if;

  select * into v_catalog
  from lihen_private.control_center_operation_catalog c
  where c.operation_code=p_operation_code;
  if not found then
    raise exception using errcode='22023', message='LIHEN_OPERATION_CODE_UNKNOWN';
  end if;

  v_fingerprint := md5(coalesce(p_request_payload,'{}'::jsonb)::text);

  select * into v_existing
  from lihen_private.control_center_operation_intents i
  where i.operation_key=p_operation_key;

  if found then
    if v_existing.operation_code <> p_operation_code or v_existing.request_fingerprint <> v_fingerprint then
      raise exception using errcode='23505', message='LIHEN_OPERATION_KEY_REUSE_MISMATCH';
    end if;
    v_intent := v_existing;
  else
    insert into lihen_private.control_center_operation_intents(
      operation_key, operation_code, actor_id, request_payload, request_fingerprint, preview_snapshot
    ) values (
      p_operation_key,
      p_operation_code,
      v_actor,
      coalesce(p_request_payload,'{}'::jsonb),
      v_fingerprint,
      jsonb_build_object(
        'operation_code',v_catalog.operation_code,
        'domain_code',v_catalog.domain_code,
        'risk_level',v_catalog.risk_level,
        'action_kind',v_catalog.action_kind,
        'requires_confirmation',v_catalog.requires_confirmation,
        'execution_enabled',false,
        'execution_note','PREVIEW_ONLY_NO_BUSINESS_MUTATION'
      )
    ) returning * into v_intent;
  end if;

  return query select
    v_intent.intent_id,
    v_intent.operation_key,
    v_intent.operation_code,
    v_catalog.domain_code,
    v_catalog.risk_level,
    v_catalog.action_kind,
    v_catalog.requires_confirmation,
    false,
    v_intent.status,
    v_intent.confirmation_token,
    v_intent.preview_snapshot,
    v_intent.expires_at;
end;
$$;

revoke all on function public.prepare_control_center_operation_controlled(text,text,jsonb) from public, anon;
grant execute on function public.prepare_control_center_operation_controlled(text,text,jsonb) to authenticated, postgres;

create or replace function public.confirm_control_center_operation_controlled(
  p_intent_id uuid,
  p_confirmation_token uuid
)
returns table(
  intent_id uuid,
  operation_code text,
  status text,
  confirmed_at timestamptz,
  execution_enabled boolean,
  execution_note text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_intent lihen_private.control_center_operation_intents%rowtype;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_OPERATION_CONFIRM_FORBIDDEN';
  end if;

  select * into v_intent
  from lihen_private.control_center_operation_intents i
  where i.intent_id=p_intent_id and i.actor_id=v_actor
  for update;
  if not found then
    raise exception using errcode='P0002', message='LIHEN_OPERATION_INTENT_NOT_FOUND';
  end if;
  if v_intent.confirmation_token <> p_confirmation_token then
    raise exception using errcode='42501', message='LIHEN_OPERATION_CONFIRMATION_TOKEN_INVALID';
  end if;
  if v_intent.expires_at <= now() and v_intent.status='PREVIEWED' then
    update lihen_private.control_center_operation_intents
    set status='EXPIRED', updated_at=now()
    where intent_id=v_intent.intent_id;
    raise exception using errcode='22023', message='LIHEN_OPERATION_INTENT_EXPIRED';
  end if;
  if v_intent.status='PREVIEWED' then
    update lihen_private.control_center_operation_intents
    set status='CONFIRMED', confirmed_at=now(), updated_at=now()
    where intent_id=v_intent.intent_id
    returning * into v_intent;
  elsif v_intent.status <> 'CONFIRMED' then
    raise exception using errcode='22023', message='LIHEN_OPERATION_INTENT_NOT_CONFIRMABLE';
  end if;

  return query select
    v_intent.intent_id,
    v_intent.operation_code,
    v_intent.status,
    v_intent.confirmed_at,
    false,
    'CONFIRMED_BUT_EXECUTION_STILL_DISABLED'::text;
end;
$$;

revoke all on function public.confirm_control_center_operation_controlled(uuid,uuid) from public, anon;
grant execute on function public.confirm_control_center_operation_controlled(uuid,uuid) to authenticated, postgres;

create or replace view lihen_private.phase6_1b_dry_run_confirmation_readiness as
with catalog as (
  select
    count(*)::int as catalog_entries,
    count(*) filter(where execution_enabled=false)::int as execution_disabled_entries,
    count(*) filter(where requires_confirmation=true)::int as confirmation_entries
  from lihen_private.control_center_operation_catalog
), intents as (
  select count(*)::int as intent_rows from lihen_private.control_center_operation_intents
), fns as (
  select count(*)::int as present_functions
  from (values
    ('prepare_control_center_operation_controlled'),
    ('confirm_control_center_operation_controlled')
  ) x(name)
  where exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=x.name
  )
), style as (
  select count(*) filter(where status='ACTIVE')::int as active_products,
         count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products
  from public.products where business_line='STYLE'
), p61a as (
  select status from lihen_private.phase_exit_gate_results where phase_code='6.1A'
)
select
  case when (select status from p61a)='PASS'
    and c.catalog_entries=14
    and c.execution_disabled_entries=14
    and c.confirmation_entries=14
    and f.present_functions=2
    and s.visible_products=0
  then 'PASS' else 'BLOCKED' end as readiness_status,
  c.catalog_entries,
  c.execution_disabled_entries,
  c.confirmation_entries,
  f.present_functions as preview_confirmation_functions,
  i.intent_rows,
  s.active_products as style_active_products,
  s.visible_products as style_visible_products,
  jsonb_build_array(
    'PREVIEW_CREATES_METADATA_ONLY',
    'CONFIRM_DOES_NOT_EXECUTE_BUSINESS_OPERATION',
    'OPERATION_KEY_IDEMPOTENCY',
    'PAYLOAD_FINGERPRINT_MISMATCH_BLOCKED',
    'CONFIRMATION_TOKEN_REQUIRED',
    '30_MINUTE_INTENT_EXPIRY',
    'OWNER_ADMIN_ONLY',
    'CATALOG_EXECUTION_REMAINS_DISABLED',
    'STYLE_REMAINS_HIDDEN',
    'NO_PRODUCTION_WRITES'
  ) as contract
from catalog c cross join intents i cross join fns f cross join style s;

revoke all on lihen_private.phase6_1b_dry_run_confirmation_readiness from public, anon, authenticated;
grant select on lihen_private.phase6_1b_dry_run_confirmation_readiness to postgres;

insert into lihen_private.phase_exit_gate_results(
  phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at
)
select
  '6.1B',
  case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,
  'PHASE6_1B_DRY_RUN_CONFIRMATION_FOUNDATION_V1',
  jsonb_build_object(
    'catalog_entries',r.catalog_entries,
    'execution_disabled_entries',r.execution_disabled_entries,
    'confirmation_entries',r.confirmation_entries,
    'preview_confirmation_functions',r.preview_confirmation_functions,
    'intent_rows',r.intent_rows,
    'style_active_products',r.style_active_products,
    'style_visible_products',r.style_visible_products,
    'contract',r.contract
  ),
  '[]'::jsonb,
  'FASE 6.1B foundation only. PREVIEW and CONFIRM operate on private intent metadata; no business execution RPC is introduced and catalog execution remains disabled.',
  now()
from lihen_private.phase6_1b_dry_run_confirmation_readiness r
on conflict (phase_code) do update set
 status=excluded.status,
 gate_version=excluded.gate_version,
 metrics=excluded.metrics,
 accepted_waivers=excluded.accepted_waivers,
 notes=excluded.notes,
 evaluated_at=excluded.evaluated_at;
