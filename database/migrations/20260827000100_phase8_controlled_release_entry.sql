create or replace view lihen_private.phase8_controlled_release_entry_readiness as
with p75 as (select status from lihen_private.phase_exit_gate_results where phase_code='7.5'),
g as (select count(*)::int as operations,count(*) filter(where execution_allowed=false)::int as blocked,count(*) filter(where approval_state='NOT_REQUESTED')::int as not_requested from lihen_private.control_center_operation_canary_execution_guard),
s as (select count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products from public.products where business_line='STYLE')
select case when (select status from p75)='PASS' and g.operations=14 and g.blocked=14 and g.not_requested=14 and s.visible_products=0 then 'PASS' else 'BLOCKED' end as readiness_status,g.operations,g.blocked,g.not_requested,s.visible_products as style_visible_products,jsonb_build_array('PHASE7_CONTROL_PLANE_CLOSED','PHASE8_RELEASE_ENTRY_ONLY','ALL_EXECUTION_STILL_BLOCKED','NO_APPROVAL_REQUESTED','NO_RELEASE_AUTO_GRANTED','STYLE_REMAINS_HIDDEN','NO_PRODUCTION_WRITES') as contract
from g cross join s;
revoke all on lihen_private.phase8_controlled_release_entry_readiness from public,anon,authenticated;
grant select on lihen_private.phase8_controlled_release_entry_readiness to postgres;

create or replace function public.get_phase8_controlled_release_entry_readiness_controlled()
returns setof lihen_private.phase8_controlled_release_entry_readiness language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PHASE8_ENTRY_READ_FORBIDDEN'; end if;
 return query select * from lihen_private.phase8_controlled_release_entry_readiness;
end; $$;
revoke all on function public.get_phase8_controlled_release_entry_readiness_controlled() from public,anon;
grant execute on function public.get_phase8_controlled_release_entry_readiness_controlled() to authenticated,postgres;

insert into lihen_private.phase_exit_gate_results(phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at)
select '8.0',case when readiness_status='PASS' then 'PASS' else 'BLOCKED' end,'PHASE8_CONTROLLED_RELEASE_ENTRY_V1',jsonb_build_object('operations',operations,'blocked',blocked,'not_requested',not_requested,'style_visible_products',style_visible_products,'contract',contract),'[]'::jsonb,'FASE 8 entry only. Release authorization preparation begins with every operation still blocked and no approval requested or granted.',now()
from lihen_private.phase8_controlled_release_entry_readiness
on conflict(phase_code) do update set status=excluded.status,gate_version=excluded.gate_version,metrics=excluded.metrics,accepted_waivers=excluded.accepted_waivers,notes=excluded.notes,evaluated_at=excluded.evaluated_at;
