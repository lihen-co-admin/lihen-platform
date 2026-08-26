create or replace view lihen_private.control_center_operation_contract_registry as
select
  c.operation_code,
  c.domain_code,
  c.risk_level,
  c.action_kind,
  c.function_name,
  c.execution_enabled,
  c.requires_confirmation,
  p.oid as function_oid,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as result_signature,
  p.pronargs::int as input_argument_count,
  p.pronargdefaults::int as default_argument_count,
  (p.proargnames[1] = 'p_operation_key') as operation_key_first,
  coalesce(
    (select jsonb_agg(jsonb_build_object(
      'name', arg_name,
      'required', ordinality <= greatest(p.pronargs::int - p.pronargdefaults::int, 1)
    ) order by ordinality)
     from unnest(p.proargnames[2:p.pronargs]) with ordinality as args(arg_name, ordinality)),
    '[]'::jsonb
  ) as payload_arguments
from lihen_private.control_center_operation_catalog c
left join pg_namespace n on n.nspname='public'
left join pg_proc p on p.pronamespace=n.oid and p.proname=c.function_name;

revoke all on lihen_private.control_center_operation_contract_registry from public,anon,authenticated;
grant select on lihen_private.control_center_operation_contract_registry to postgres;

create or replace function public.get_control_center_operation_contracts_controlled()
returns table(
  operation_code text,
  domain_code text,
  risk_level text,
  action_kind text,
  function_name text,
  execution_enabled boolean,
  requires_confirmation boolean,
  identity_arguments text,
  result_signature text,
  operation_key_first boolean,
  payload_arguments jsonb
)
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then raise exception using errcode='42501',message='LIHEN_OPERATION_CONTRACT_READ_FORBIDDEN'; end if;
  return query
  select r.operation_code,r.domain_code,r.risk_level,r.action_kind,r.function_name,
         r.execution_enabled,r.requires_confirmation,r.identity_arguments,r.result_signature,
         r.operation_key_first,r.payload_arguments
  from lihen_private.control_center_operation_contract_registry r
  order by r.domain_code,r.operation_code;
end;$$;

revoke all on function public.get_control_center_operation_contracts_controlled() from public,anon;
grant execute on function public.get_control_center_operation_contracts_controlled() to authenticated,postgres;

create or replace function public.validate_control_center_operation_payload_controlled(
  p_operation_code text,
  p_request_payload jsonb
)
returns table(
  operation_code text,
  valid boolean,
  payload_is_object boolean,
  missing_required_keys text[],
  unexpected_keys text[],
  expected_arguments jsonb,
  execution_enabled boolean,
  validation_note text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_registry lihen_private.control_center_operation_contract_registry%rowtype;
  v_payload jsonb:=coalesce(p_request_payload,'{}'::jsonb);
  v_is_object boolean;
  v_required text[];
  v_expected text[];
  v_missing text[];
  v_unexpected text[];
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then raise exception using errcode='42501',message='LIHEN_OPERATION_PAYLOAD_VALIDATE_FORBIDDEN'; end if;

  select * into v_registry
  from lihen_private.control_center_operation_contract_registry r
  where r.operation_code=p_operation_code;
  if not found or v_registry.function_oid is null then
    raise exception using errcode='22023',message='LIHEN_OPERATION_CONTRACT_UNKNOWN';
  end if;

  v_is_object := jsonb_typeof(v_payload)='object';

  select coalesce(array_agg(x->>'name' order by ordinality) filter(where coalesce((x->>'required')::boolean,false)),'{}'::text[]),
         coalesce(array_agg(x->>'name' order by ordinality),'{}'::text[])
    into v_required,v_expected
  from jsonb_array_elements(v_registry.payload_arguments) with ordinality as a(x,ordinality);

  if v_is_object then
    select coalesce(array_agg(k order by k),'{}'::text[])
      into v_missing
    from unnest(v_required) k
    where not (v_payload ? k);

    select coalesce(array_agg(k order by k),'{}'::text[])
      into v_unexpected
    from jsonb_object_keys(v_payload) k
    where not (k = any(v_expected));
  else
    v_missing := v_required;
    v_unexpected := '{}'::text[];
  end if;

  return query select
    v_registry.operation_code,
    (v_is_object and cardinality(v_missing)=0 and cardinality(v_unexpected)=0 and v_registry.operation_key_first and not v_registry.execution_enabled),
    v_is_object,
    v_missing,
    v_unexpected,
    v_registry.payload_arguments,
    false,
    case
      when not v_is_object then 'PAYLOAD_MUST_BE_JSON_OBJECT'
      when not v_registry.operation_key_first then 'BACKING_FUNCTION_CONTRACT_INVALID'
      when cardinality(v_missing)>0 then 'MISSING_REQUIRED_KEYS'
      when cardinality(v_unexpected)>0 then 'UNEXPECTED_KEYS'
      else 'VALID_FOR_PREVIEW_ONLY_EXECUTION_DISABLED'
    end;
end;$$;

revoke all on function public.validate_control_center_operation_payload_controlled(text,jsonb) from public,anon;
grant execute on function public.validate_control_center_operation_payload_controlled(text,jsonb) to authenticated,postgres;

create or replace view lihen_private.phase6_2_operation_contract_validation_readiness as
with registry as (
  select count(*)::int as contracts,
         count(*) filter(where function_oid is not null)::int as backing_functions,
         count(*) filter(where operation_key_first)::int as operation_key_first_count,
         count(*) filter(where execution_enabled=false)::int as execution_disabled,
         count(*) filter(where jsonb_array_length(payload_arguments)>0)::int as contracts_with_payload
  from lihen_private.control_center_operation_contract_registry
), fns as (
  select count(*)::int as present_functions
  from (values
    ('get_control_center_operation_contracts_controlled'),
    ('validate_control_center_operation_payload_controlled')
  ) x(name)
  where exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=x.name
  )
), style as (
  select count(*) filter(where status='ACTIVE')::int as active_products,
         count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products
  from public.products where business_line='STYLE'
), p61c as (
  select status from lihen_private.phase_exit_gate_results where phase_code='6.1C'
)
select
  case when (select status from p61c)='PASS'
    and r.contracts=14
    and r.backing_functions=14
    and r.operation_key_first_count=14
    and r.execution_disabled=14
    and r.contracts_with_payload=14
    and f.present_functions=2
    and s.visible_products=0
  then 'PASS' else 'BLOCKED' end as readiness_status,
  r.contracts,
  r.backing_functions,
  r.operation_key_first_count,
  r.execution_disabled,
  r.contracts_with_payload,
  f.present_functions as contract_validation_functions,
  s.active_products as style_active_products,
  s.visible_products as style_visible_products,
  jsonb_build_array(
    'BACKING_RPC_SIGNATURE_DISCOVERY',
    'PAYLOAD_KEY_VALIDATION_BEFORE_PREVIEW',
    'REQUIRED_AND_OPTIONAL_ARGUMENT_METADATA',
    'OPERATION_KEY_RESERVED_OUTSIDE_PAYLOAD',
    'OWNER_ADMIN_ONLY',
    'EXECUTION_REMAINS_DISABLED',
    'STYLE_REMAINS_HIDDEN',
    'NO_PRODUCTION_WRITES'
  ) as contract
from registry r cross join fns f cross join style s;

revoke all on lihen_private.phase6_2_operation_contract_validation_readiness from public,anon,authenticated;
grant select on lihen_private.phase6_2_operation_contract_validation_readiness to postgres;

insert into lihen_private.phase_exit_gate_results(
  phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at
)
select
  '6.2',
  case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,
  'PHASE6_2_OPERATION_CONTRACT_VALIDATION_FOUNDATION_V1',
  jsonb_build_object(
    'contracts',r.contracts,
    'backing_functions',r.backing_functions,
    'operation_key_first_count',r.operation_key_first_count,
    'execution_disabled',r.execution_disabled,
    'contracts_with_payload',r.contracts_with_payload,
    'contract_validation_functions',r.contract_validation_functions,
    'style_active_products',r.style_active_products,
    'style_visible_products',r.style_visible_products,
    'contract',r.contract
  ),
  '[]'::jsonb,
  'FASE 6.2 foundation validates operation payload shape against backing RPC signatures before future execution. No business operation is executed and all catalog operations remain disabled.',
  now()
from lihen_private.phase6_2_operation_contract_validation_readiness r
on conflict (phase_code) do update set
  status=excluded.status,
  gate_version=excluded.gate_version,
  metrics=excluded.metrics,
  accepted_waivers=excluded.accepted_waivers,
  notes=excluded.notes,
  evaluated_at=excluded.evaluated_at;
