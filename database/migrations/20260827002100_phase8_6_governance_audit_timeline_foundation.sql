create or replace view lihen_private.control_center_governance_audit_timeline as
select 'OPERATION_INTENT'::text as event_source,i.intent_id::text as event_id,i.operation_code,i.actor_id,i.status as event_status,i.operation_key as correlation_key,i.created_at as occurred_at,jsonb_build_object('previewed_at',i.previewed_at,'confirmed_at',i.confirmed_at,'expires_at',i.expires_at,'cancelled_at',i.cancelled_at,'execution_enabled',false) as event_metadata
from lihen_private.control_center_operation_intents i
union all
select 'RELEASE_REQUEST'::text,r.release_request_id::text,r.operation_code,r.requested_by,r.request_status,r.release_request_id::text,r.requested_at,jsonb_build_object('requested_environment',r.requested_environment,'approved_by',r.approved_by,'approved_at',r.approved_at,'expires_at',r.expires_at,'execution_enabled',false)
from lihen_private.control_center_operation_release_requests r;
revoke all on lihen_private.control_center_governance_audit_timeline from public,anon,authenticated;
grant select on lihen_private.control_center_governance_audit_timeline to postgres;

create or replace function public.get_control_center_governance_audit_timeline_controlled(p_limit integer default 50,p_offset integer default 0,p_event_source text default null,p_operation_code text default null,p_actor_id uuid default null)
returns table(event_source text,event_id text,operation_code text,actor_id uuid,event_status text,correlation_key text,occurred_at timestamptz,event_metadata jsonb)
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_GOVERNANCE_AUDIT_READ_FORBIDDEN'; end if;
 if p_limit<1 or p_limit>200 then raise exception using errcode='22023',message='LIHEN_GOVERNANCE_AUDIT_LIMIT_INVALID'; end if;
 if p_offset<0 then raise exception using errcode='22023',message='LIHEN_GOVERNANCE_AUDIT_OFFSET_INVALID'; end if;
 return query select g.event_source,g.event_id,g.operation_code,g.actor_id,g.event_status,g.correlation_key,g.occurred_at,g.event_metadata from lihen_private.control_center_governance_audit_timeline g where (p_event_source is null or g.event_source=p_event_source) and (p_operation_code is null or g.operation_code=p_operation_code) and (p_actor_id is null or g.actor_id=p_actor_id) order by g.occurred_at desc,g.event_id desc limit p_limit offset p_offset;
end; $$;
revoke all on function public.get_control_center_governance_audit_timeline_controlled(integer,integer,text,text,uuid) from public,anon;
grant execute on function public.get_control_center_governance_audit_timeline_controlled(integer,integer,text,text,uuid) to authenticated,postgres;

create or replace view lihen_private.phase8_6_governance_audit_timeline_readiness as
with fn as (select count(*)::int as read_functions from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_control_center_governance_audit_timeline_controlled'),
events as (select count(*)::int as audit_rows,count(*) filter(where event_source='OPERATION_INTENT')::int as intent_rows,count(*) filter(where event_source='RELEASE_REQUEST')::int as release_rows from lihen_private.control_center_governance_audit_timeline),
catalog as (select count(*) filter(where execution_enabled=false)::int as execution_disabled from lihen_private.control_center_operation_catalog),
release_guard as (select count(*) filter(where release_authorized=false)::int as release_blocked from lihen_private.control_center_operation_release_authorization_guard),
style as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE'),
p85 as (select status from lihen_private.phase_exit_gate_results where phase_code='8.5')
select case when (select status from p85)='PASS' and f.read_functions=1 and c.execution_disabled=14 and rg.release_blocked=14 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,f.read_functions,e.audit_rows,e.intent_rows,e.release_rows,c.execution_disabled,rg.release_blocked,s.visible_products as style_visible_products,jsonb_build_array('GOVERNANCE_AUDIT_TIMELINE_READ_ONLY','OPERATION_INTENT_EVENTS_INCLUDED','RELEASE_REQUEST_EVENTS_INCLUDED','NO_REQUEST_PAYLOAD_EXPOSED','OWNER_ADMIN_ONLY','MAX_PAGE_SIZE_200','EXECUTION_REMAINS_BLOCKED','NO_PRODUCTION_WRITES') as contract
from fn f cross join events e cross join catalog c cross join release_guard rg cross join style s;
revoke all on lihen_private.phase8_6_governance_audit_timeline_readiness from public,anon,authenticated;
grant select on lihen_private.phase8_6_governance_audit_timeline_readiness to postgres;
insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '8.6',case when readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE8_6_GOVERNANCE_AUDIT_TIMELINE_FOUNDATION_V1',jsonb_build_object('read_functions',read_functions,'audit_rows',audit_rows,'intent_rows',intent_rows,'release_rows',release_rows,'execution_disabled',execution_disabled,'release_blocked',release_blocked,'style_visible_products',style_visible_products,'contract',contract),'[]'::jsonb,'FASE 8.6 adds a read-only governance audit timeline without exposing request payloads or enabling execution.',now()
from lihen_private.phase8_6_governance_audit_timeline_readiness
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
