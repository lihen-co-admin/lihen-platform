create or replace function public.request_control_center_canary_release_controlled(p_operation_code text,p_request_reason text)
returns table(release_request_id uuid,operation_code text,request_status text,requested_environment text,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_role text; v_request_id uuid;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 select p.role_code into v_role from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE';
 if v_role not in ('OWNER','ADMIN') then raise exception using errcode='42501',message='LIHEN_RELEASE_REQUEST_FORBIDDEN'; end if;
 if coalesce(trim(p_request_reason),'')='' then raise exception using errcode='22023',message='LIHEN_RELEASE_REQUEST_REASON_REQUIRED'; end if;
 if not exists(select 1 from lihen_private.control_center_operation_canary_policy p join lihen_private.control_center_operation_catalog c using(operation_code) where p.operation_code=p_operation_code and p.canary_eligible and not p.canary_enabled and p.max_canary_attempts_per_hour=0 and c.risk_level='MEDIUM') then raise exception using errcode='22023',message='LIHEN_OPERATION_NOT_CANARY_REQUEST_ELIGIBLE'; end if;
 if exists(select 1 from lihen_private.control_center_operation_release_requests r where r.operation_code=p_operation_code and r.request_status='PENDING') then raise exception using errcode='23505',message='LIHEN_RELEASE_REQUEST_ALREADY_PENDING'; end if;
 insert into lihen_private.control_center_operation_release_requests(operation_code,requested_by,requested_environment,request_reason,request_status,expires_at)
 values(p_operation_code,v_actor,'DEV_ONLY',trim(p_request_reason),'PENDING',now()+interval '30 minutes')
 returning control_center_operation_release_requests.release_request_id into v_request_id;
 update lihen_private.control_center_operation_canary_approval_policy set approval_state='PENDING',updated_at=now() where control_center_operation_canary_approval_policy.operation_code=p_operation_code;
 return query select r.release_request_id,r.operation_code,r.request_status,r.requested_environment,r.expires_at from lihen_private.control_center_operation_release_requests r where r.release_request_id=v_request_id;
end; $$;
revoke all on function public.request_control_center_canary_release_controlled(text,text) from public,anon;
grant execute on function public.request_control_center_canary_release_controlled(text,text) to authenticated,postgres;

create or replace function public.decide_control_center_canary_release_controlled(p_release_request_id uuid,p_decision text)
returns table(release_request_id uuid,operation_code text,request_status text,approved_by uuid,approved_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_role text; v_request lihen_private.control_center_operation_release_requests%rowtype; v_decision text:=upper(trim(coalesce(p_decision,'')));
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 select p.role_code into v_role from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE';
 if v_role<>'OWNER' then raise exception using errcode='42501',message='LIHEN_RELEASE_DECISION_OWNER_REQUIRED'; end if;
 if v_decision not in ('APPROVED','REJECTED') then raise exception using errcode='22023',message='LIHEN_RELEASE_DECISION_INVALID'; end if;
 select * into v_request from lihen_private.control_center_operation_release_requests r where r.release_request_id=p_release_request_id for update;
 if not found then raise exception using errcode='22023',message='LIHEN_RELEASE_REQUEST_NOT_FOUND'; end if;
 if v_request.request_status<>'PENDING' then raise exception using errcode='22023',message='LIHEN_RELEASE_REQUEST_NOT_PENDING'; end if;
 if v_request.expires_at<=now() then
  update lihen_private.control_center_operation_release_requests set request_status='EXPIRED',updated_at=now() where release_request_id=p_release_request_id;
  update lihen_private.control_center_operation_canary_approval_policy set approval_state='EXPIRED',updated_at=now() where operation_code=v_request.operation_code;
  return query select r.release_request_id,r.operation_code,r.request_status,r.approved_by,r.approved_at,r.expires_at from lihen_private.control_center_operation_release_requests r where r.release_request_id=p_release_request_id;
  return;
 end if;
 if v_request.requested_by=v_actor and v_decision='APPROVED' then raise exception using errcode='42501',message='LIHEN_RELEASE_SELF_APPROVAL_FORBIDDEN'; end if;
 update lihen_private.control_center_operation_release_requests
 set request_status=v_decision,approved_by=case when v_decision='APPROVED' then v_actor else null end,approved_at=case when v_decision='APPROVED' then now() else null end,updated_at=now()
 where release_request_id=p_release_request_id;
 update lihen_private.control_center_operation_canary_approval_policy set approval_state=v_decision,updated_at=now() where operation_code=v_request.operation_code;
 return query select r.release_request_id,r.operation_code,r.request_status,r.approved_by,r.approved_at,r.expires_at from lihen_private.control_center_operation_release_requests r where r.release_request_id=p_release_request_id;
end; $$;
revoke all on function public.decide_control_center_canary_release_controlled(uuid,text) from public,anon;
grant execute on function public.decide_control_center_canary_release_controlled(uuid,text) to authenticated,postgres;

create or replace view lihen_private.phase8_3_manual_release_workflow_rpc_readiness as
with f as (select count(*)::int as functions_present from (values('request_control_center_canary_release_controlled'),('decide_control_center_canary_release_controlled')) x(name) where exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=x.name)),
r as (select count(*)::int as requests,count(*) filter(where request_status='APPROVED')::int as approved_requests from lihen_private.control_center_operation_release_requests),
g as (select count(*) filter(where release_authorized=false)::int as blocked from lihen_private.control_center_operation_release_authorization_guard),
p82 as (select status from lihen_private.phase_exit_gate_results where phase_code='8.2')
select case when (select status from p82)='PASS' and f.functions_present=2 and r.requests=0 and r.approved_requests=0 and g.blocked=14 then 'PASS' else 'BLOCKED' end as readiness_status,f.functions_present,r.requests,r.approved_requests,g.blocked,jsonb_build_array('RELEASE_REQUEST_RPC_PRESENT','OWNER_ONLY_RELEASE_DECISION','SELF_APPROVAL_FORBIDDEN','THIRTY_MINUTE_EXPIRY','DEV_CANARY_ONLY','NO_REQUEST_AUTO_CREATED','ZERO_RELEASE_AUTHORIZED','FINAL_EXECUTION_RELEASE_NOT_IMPLEMENTED') as contract
from f cross join r cross join g;
revoke all on lihen_private.phase8_3_manual_release_workflow_rpc_readiness from public,anon,authenticated;
grant select on lihen_private.phase8_3_manual_release_workflow_rpc_readiness to postgres;
insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '8.3',case when readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE8_3_MANUAL_RELEASE_WORKFLOW_RPC_FOUNDATION_V1',jsonb_build_object('functions_present',functions_present,'requests',requests,'approved_requests',approved_requests,'blocked',blocked,'contract',contract),'[]'::jsonb,'FASE 8.3 adds metadata-only release request and decision RPCs with separation of duties. No request was created and execution remains blocked.',now()
from lihen_private.phase8_3_manual_release_workflow_rpc_readiness
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
