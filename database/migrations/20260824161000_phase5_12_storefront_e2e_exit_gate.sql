create table if not exists lihen_private.storefront_e2e_evidence (
  id uuid primary key default gen_random_uuid(),
  suite_version text not null check (btrim(suite_version) <> ''),
  commit_sha text not null check (commit_sha ~ '^[0-9a-fA-F]{7,64}$'),
  result text not null check (result in ('PASS','FAIL')),
  metrics jsonb not null default '{}'::jsonb,
  actor_id uuid not null references auth.users(id),
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (suite_version, commit_sha)
);

revoke all on table lihen_private.storefront_e2e_evidence from public, anon, authenticated;
grant select, insert, update on table lihen_private.storefront_e2e_evidence to service_role;

create or replace function public.evaluate_phase5_storefront_exit_gate_controlled()
returns table(phase_code text,status text,gate_version text,metrics jsonb)
language plpgsql
security definer
set search_path = public, lihen_private, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_expected integer := 0;
  v_visible integer := 0;
  v_projection integer := 0;
  v_phase4 boolean := false;
  v_phase52 boolean := false;
  v_outside integer := -1;
  v_e2e record;
  v_status text;
  v_metrics jsonb;
begin
  if v_actor is null or not exists(
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501',message='LIHEN_PHASE5_EXIT_GATE_FORBIDDEN';
  end if;

  select exists(select 1 from lihen_private.phase_exit_gate_results g where g.phase_code='4' and g.status='PASS') into v_phase4;
  select exists(select 1 from lihen_private.phase_exit_gate_results g where g.phase_code='5.2' and g.status='PASS') into v_phase52;
  select coalesce((g.metrics->>'expected_visible_count')::integer,0),coalesce((g.metrics->>'outside_visible_current_count')::integer,-1)
    into v_expected,v_outside
  from lihen_private.phase_exit_gate_results g where g.phase_code='5.2';

  select count(*)::integer into v_visible from public.products where visible_on_website=true;
  select count(*)::integer into v_projection
  from public.products p
  where p.status='ACTIVE' and p.visible_on_website=true and p.sale_price is not null and p.sale_price>=0
    and exists(select 1 from public.product_images pi where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>'');

  select e.* into v_e2e
  from lihen_private.storefront_e2e_evidence e
  order by e.evaluated_at desc,e.created_at desc limit 1;

  v_status := case when v_phase4 and v_phase52 and v_expected>0 and v_visible=v_expected and v_projection=v_expected and v_outside=0 and coalesce(v_e2e.result,'FAIL')='PASS' then 'PASS' else 'BLOCKED' end;
  v_metrics := jsonb_build_object(
    'phase4_pass',v_phase4,
    'phase5_2_pass',v_phase52,
    'expected_visible_count',v_expected,
    'actual_visible_count',v_visible,
    'storefront_projection_count',v_projection,
    'outside_visible_count',v_outside,
    'e2e_evidence_present',v_e2e.id is not null,
    'e2e_suite_version',v_e2e.suite_version,
    'e2e_commit_sha',v_e2e.commit_sha,
    'e2e_result',v_e2e.result,
    'e2e_metrics',v_e2e.metrics
  );

  insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at,created_at)
  values('5',v_status,'PHASE5_STOREFRONT_E2E_EXIT_GATE_V1',v_metrics,'[]'::jsonb,
    case when v_status='PASS' then 'Storefront exit gate passed with canonical data and registered E2E evidence.' else 'Storefront exit gate remains blocked until all canonical checks and E2E evidence pass.' end,
    now(),now())
  on conflict (phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;

  return query select '5'::text,v_status,'PHASE5_STOREFRONT_E2E_EXIT_GATE_V1'::text,v_metrics;
end;
$function$;

create or replace function public.register_storefront_e2e_evidence_controlled(
  p_suite_version text,
  p_commit_sha text,
  p_result text,
  p_metrics jsonb default '{}'::jsonb
)
returns table(evidence_id uuid,gate_status text,gate_metrics jsonb)
language plpgsql
security definer
set search_path = public, lihen_private, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_gate record;
begin
  if v_actor is null or not exists(
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501',message='LIHEN_STOREFRONT_E2E_EVIDENCE_FORBIDDEN';
  end if;
  if btrim(coalesce(p_suite_version,''))='' or btrim(coalesce(p_commit_sha,''))='' or upper(coalesce(p_result,'')) not in ('PASS','FAIL') then
    raise exception using errcode='22023',message='LIHEN_STOREFRONT_E2E_EVIDENCE_INVALID';
  end if;

  insert into lihen_private.storefront_e2e_evidence(suite_version,commit_sha,result,metrics,actor_id,evaluated_at)
  values(btrim(p_suite_version),lower(btrim(p_commit_sha)),upper(p_result),coalesce(p_metrics,'{}'::jsonb),v_actor,now())
  on conflict (suite_version,commit_sha) do update set result=excluded.result,metrics=excluded.metrics,actor_id=excluded.actor_id,evaluated_at=excluded.evaluated_at
  returning id into v_id;

  select * into v_gate from public.evaluate_phase5_storefront_exit_gate_controlled();
  return query select v_id,v_gate.status,v_gate.metrics;
end;
$function$;

revoke all on function public.evaluate_phase5_storefront_exit_gate_controlled() from public;
revoke all on function public.register_storefront_e2e_evidence_controlled(text,text,text,jsonb) from public;
grant execute on function public.evaluate_phase5_storefront_exit_gate_controlled() to authenticated;
grant execute on function public.register_storefront_e2e_evidence_controlled(text,text,text,jsonb) to authenticated;
