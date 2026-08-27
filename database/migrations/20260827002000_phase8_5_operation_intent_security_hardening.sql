create or replace function public.prepare_control_center_operation_controlled(p_operation_key text, p_operation_code text, p_request_payload jsonb)
returns table(intent_id uuid, operation_key text, operation_code text, domain_code text, risk_level text, action_kind text, requires_confirmation boolean, execution_enabled boolean, status text, confirmation_token uuid, preview_snapshot jsonb, expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_catalog lihen_private.control_center_operation_catalog%rowtype; v_fingerprint text; v_existing lihen_private.control_center_operation_intents%rowtype; v_intent lihen_private.control_center_operation_intents%rowtype;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_OPERATION_PREVIEW_FORBIDDEN'; end if;
 if nullif(btrim(p_operation_key),'') is null then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
 select * into v_catalog from lihen_private.control_center_operation_catalog c where c.operation_code=p_operation_code;
 if not found then raise exception using errcode='22023',message='LIHEN_OPERATION_CODE_UNKNOWN'; end if;
 v_fingerprint:=md5(coalesce(p_request_payload,'{}'::jsonb)::text);
 select * into v_existing from lihen_private.control_center_operation_intents i where i.operation_key=p_operation_key;
 if found then
  if v_existing.actor_id<>v_actor then raise exception using errcode='42501',message='LIHEN_OPERATION_KEY_OWNERSHIP_MISMATCH'; end if;
  if v_existing.operation_code<>p_operation_code or v_existing.request_fingerprint<>v_fingerprint then raise exception using errcode='23505',message='LIHEN_OPERATION_KEY_REUSE_MISMATCH'; end if;
  if v_existing.status='PREVIEWED' and v_existing.expires_at<=now() then update lihen_private.control_center_operation_intents set status='EXPIRED',updated_at=now() where intent_id=v_existing.intent_id returning * into v_existing; end if;
  v_intent:=v_existing;
 else
  insert into lihen_private.control_center_operation_intents(operation_key,operation_code,actor_id,request_payload,request_fingerprint,preview_snapshot)
  values(p_operation_key,p_operation_code,v_actor,coalesce(p_request_payload,'{}'::jsonb),v_fingerprint,jsonb_build_object('operation_code',v_catalog.operation_code,'domain_code',v_catalog.domain_code,'risk_level',v_catalog.risk_level,'action_kind',v_catalog.action_kind,'requires_confirmation',v_catalog.requires_confirmation,'execution_enabled',false,'execution_note','PREVIEW_ONLY_NO_BUSINESS_MUTATION')) returning * into v_intent;
 end if;
 return query select v_intent.intent_id,v_intent.operation_key,v_intent.operation_code,v_catalog.domain_code,v_catalog.risk_level,v_catalog.action_kind,v_catalog.requires_confirmation,false,v_intent.status,v_intent.confirmation_token,v_intent.preview_snapshot,v_intent.expires_at;
end; $$;

create or replace function public.confirm_control_center_operation_controlled(p_intent_id uuid,p_confirmation_token uuid)
returns table(intent_id uuid,operation_code text,status text,confirmed_at timestamptz,execution_enabled boolean,execution_note text)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_intent lihen_private.control_center_operation_intents%rowtype;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_OPERATION_CONFIRM_FORBIDDEN'; end if;
 select * into v_intent from lihen_private.control_center_operation_intents i where i.intent_id=p_intent_id and i.actor_id=v_actor for update;
 if not found then raise exception using errcode='P0002',message='LIHEN_OPERATION_INTENT_NOT_FOUND'; end if;
 if v_intent.confirmation_token<>p_confirmation_token then raise exception using errcode='42501',message='LIHEN_OPERATION_CONFIRMATION_TOKEN_INVALID'; end if;
 if v_intent.expires_at<=now() and v_intent.status='PREVIEWED' then
  update lihen_private.control_center_operation_intents set status='EXPIRED',updated_at=now() where intent_id=v_intent.intent_id returning * into v_intent;
  return query select v_intent.intent_id,v_intent.operation_code,v_intent.status,v_intent.confirmed_at,false,'EXPIRED_NO_EXECUTION'::text; return;
 end if;
 if v_intent.status='PREVIEWED' then update lihen_private.control_center_operation_intents set status='CONFIRMED',confirmed_at=now(),updated_at=now() where intent_id=v_intent.intent_id returning * into v_intent;
 elsif v_intent.status<>'CONFIRMED' then raise exception using errcode='22023',message='LIHEN_OPERATION_INTENT_NOT_CONFIRMABLE'; end if;
 return query select v_intent.intent_id,v_intent.operation_code,v_intent.status,v_intent.confirmed_at,false,'CONFIRMED_BUT_EXECUTION_STILL_DISABLED'::text;
end; $$;

create or replace view lihen_private.phase8_5_operation_intent_security_hardening_readiness as
with defs as (select max(case when p.proname='prepare_control_center_operation_controlled' and pg_get_functiondef(p.oid) like '%LIHEN_OPERATION_KEY_OWNERSHIP_MISMATCH%' then 1 else 0 end)::int as ownership_guard_present,max(case when p.proname='confirm_control_center_operation_controlled' and pg_get_functiondef(p.oid) like '%EXPIRED_NO_EXECUTION%' then 1 else 0 end)::int as expiry_persists_present from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('prepare_control_center_operation_controlled','confirm_control_center_operation_controlled')),
state as (select count(*)::int as intents,count(*) filter(where status='CONFIRMED')::int as confirmed,count(*) filter(where status='PREVIEWED' and expires_at<=now())::int as stale_previewed from lihen_private.control_center_operation_intents),
catalog as (select count(*) filter(where execution_enabled=false)::int as execution_disabled from lihen_private.control_center_operation_catalog),
style as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE'),
p84 as (select status from lihen_private.phase_exit_gate_results where phase_code='8.4')
select case when (select status from p84)='PASS' and d.ownership_guard_present=1 and d.expiry_persists_present=1 and c.execution_disabled=14 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,d.ownership_guard_present,d.expiry_persists_present,st.intents,st.confirmed,st.stale_previewed,c.execution_disabled,s.visible_products as style_visible_products,jsonb_build_array('OPERATION_KEY_BOUND_TO_ACTOR','CROSS_ACTOR_IDEMPOTENCY_REUSE_BLOCKED','EXPIRED_INTENT_STATE_PERSISTS','EXPIRED_CONFIRM_RETURNS_WITHOUT_BUSINESS_EXECUTION','EXECUTION_REMAINS_DISABLED','STYLE_REMAINS_HIDDEN','NO_PRODUCTION_WRITES') as contract
from defs d cross join state st cross join catalog c cross join style s;
revoke all on lihen_private.phase8_5_operation_intent_security_hardening_readiness from public,anon,authenticated;
grant select on lihen_private.phase8_5_operation_intent_security_hardening_readiness to postgres;
insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '8.5',case when readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE8_5_OPERATION_INTENT_SECURITY_HARDENING_V1',jsonb_build_object('ownership_guard_present',ownership_guard_present,'expiry_persists_present',expiry_persists_present,'intents',intents,'confirmed',confirmed,'stale_previewed',stale_previewed,'execution_disabled',execution_disabled,'style_visible_products',style_visible_products,'contract',contract),'[]'::jsonb,'FASE 8.5 hardens operation intent ownership and expiry persistence. No business execution is introduced.',now()
from lihen_private.phase8_5_operation_intent_security_hardening_readiness
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
