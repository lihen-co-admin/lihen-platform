create or replace view lihen_private.control_center_operation_audit_timeline as
select 'PRODUCTS'::text as domain_code, operation_type, operation_key, actor_id,
       product_id as entity_id, request_fingerprint, result_snapshot, created_at as occurred_at
from lihen_private.product_write_operations
union all
select 'INVENTORY', operation_type, operation_key, actor_id,
       product_id as entity_id, request_fingerprint, result_snapshot, created_at
from lihen_private.inventory_write_operations
union all
select 'ORDERS', operation_type, operation_key, actor_id,
       order_id as entity_id, request_fingerprint, result_snapshot, created_at
from lihen_private.order_write_operations
union all
select 'PROCUREMENT', operation_type, operation_key, actor_id,
       purchase_id as entity_id, request_fingerprint, result_snapshot, created_at
from lihen_private.purchase_write_operations
union all
select 'FINANCE', operation_type, operation_key, actor_id,
       coalesce(account_id,movement_id) as entity_id, request_fingerprint, result_snapshot, created_at
from lihen_private.financial_write_operations
union all
select 'SUPPLIERS', operation_type, operation_key, actor_id,
       supplier_id as entity_id, request_fingerprint, result_snapshot, created_at
from lihen_private.supplier_write_operations;

revoke all on lihen_private.control_center_operation_audit_timeline from public,anon,authenticated;
grant select on lihen_private.control_center_operation_audit_timeline to postgres;

create or replace function public.get_control_center_operation_audit_timeline_controlled(
  p_limit integer default 50,
  p_offset integer default 0,
  p_domain_code text default null,
  p_operation_type text default null,
  p_actor_id uuid default null
)
returns table(
  domain_code text,
  operation_type text,
  operation_key text,
  actor_id uuid,
  entity_id uuid,
  request_fingerprint text,
  result_snapshot jsonb,
  occurred_at timestamptz
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
  ) then raise exception using errcode='42501',message='LIHEN_OPERATION_AUDIT_READ_FORBIDDEN'; end if;
  if coalesce(p_limit,50) < 1 or coalesce(p_limit,50) > 200 then
    raise exception using errcode='22023',message='LIHEN_OPERATION_AUDIT_LIMIT_INVALID';
  end if;
  if coalesce(p_offset,0) < 0 then
    raise exception using errcode='22023',message='LIHEN_OPERATION_AUDIT_OFFSET_INVALID';
  end if;
  return query
  select a.domain_code,a.operation_type,a.operation_key,a.actor_id,a.entity_id,
         a.request_fingerprint,a.result_snapshot,a.occurred_at
  from lihen_private.control_center_operation_audit_timeline a
  where (p_domain_code is null or a.domain_code=p_domain_code)
    and (p_operation_type is null or a.operation_type=p_operation_type)
    and (p_actor_id is null or a.actor_id=p_actor_id)
  order by a.occurred_at desc,a.operation_key desc
  limit coalesce(p_limit,50) offset coalesce(p_offset,0);
end;$$;

revoke all on function public.get_control_center_operation_audit_timeline_controlled(integer,integer,text,text,uuid) from public,anon;
grant execute on function public.get_control_center_operation_audit_timeline_controlled(integer,integer,text,text,uuid) to authenticated,postgres;

create or replace view lihen_private.phase6_1c_operation_audit_timeline_readiness as
with src as (
  select count(distinct domain_code)::int as domains,
         count(*)::bigint as audit_rows
  from lihen_private.control_center_operation_audit_timeline
), fns as (
  select count(*)::int as present_functions
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_control_center_operation_audit_timeline_controlled'
), catalog as (
  select count(*)::int as catalog_entries,
         count(*) filter(where execution_enabled=false)::int as execution_disabled_entries
  from lihen_private.control_center_operation_catalog
), style as (
  select count(*) filter(where status='ACTIVE')::int as active_products,
         count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products
  from public.products where business_line='STYLE'
), p61b as (
  select status from lihen_private.phase_exit_gate_results where phase_code='6.1B'
)
select
  case when (select status from p61b)='PASS'
    and f.present_functions=1
    and c.catalog_entries=14
    and c.execution_disabled_entries=14
    and s.visible_products=0
  then 'PASS' else 'BLOCKED' end as readiness_status,
  src.domains as domains_with_history,
  src.audit_rows,
  f.present_functions as audit_read_functions,
  c.catalog_entries,
  c.execution_disabled_entries,
  s.active_products as style_active_products,
  s.visible_products as style_visible_products,
  jsonb_build_array(
    'READ_ONLY_ADMIN_TIMELINE',
    'OWNER_ADMIN_ONLY',
    'NO_DIRECT_PRIVATE_TABLE_EXPOSURE',
    'AUDIT_SOURCE_REUSES_EXISTING_WRITE_OPERATION_LOGS',
    'PAGINATED_READ_MAX_200',
    'CATALOG_EXECUTION_REMAINS_DISABLED',
    'STYLE_REMAINS_HIDDEN',
    'NO_PRODUCTION_WRITES'
  ) as contract
from src cross join fns f cross join catalog c cross join style s;

revoke all on lihen_private.phase6_1c_operation_audit_timeline_readiness from public,anon,authenticated;
grant select on lihen_private.phase6_1c_operation_audit_timeline_readiness to postgres;

insert into lihen_private.phase_exit_gate_results(
 phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at
)
select
 '6.1C',
 case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,
 'PHASE6_1C_OPERATION_AUDIT_TIMELINE_FOUNDATION_V1',
 jsonb_build_object(
   'domains_with_history',r.domains_with_history,
   'audit_rows',r.audit_rows,
   'audit_read_functions',r.audit_read_functions,
   'catalog_entries',r.catalog_entries,
   'execution_disabled_entries',r.execution_disabled_entries,
   'style_active_products',r.style_active_products,
   'style_visible_products',r.style_visible_products,
   'contract',r.contract
 ),
 '[]'::jsonb,
 'FASE 6.1C read-only audit foundation. Timeline reuses existing write-operation logs and exposes them only through an OWNER/ADMIN controlled RPC; no business mutation is executed.',
 now()
from lihen_private.phase6_1c_operation_audit_timeline_readiness r
on conflict (phase_code) do update set
 status=excluded.status,
 gate_version=excluded.gate_version,
 metrics=excluded.metrics,
 accepted_waivers=excluded.accepted_waivers,
 notes=excluded.notes,
 evaluated_at=excluded.evaluated_at;
