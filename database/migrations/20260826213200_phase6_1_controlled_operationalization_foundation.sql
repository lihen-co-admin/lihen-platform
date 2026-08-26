create or replace view lihen_private.phase6_1_controlled_operationalization_readiness as
with required_tables as (
  select unnest(array[
    'product_write_operations',
    'inventory_write_operations',
    'order_write_operations',
    'purchase_write_operations',
    'financial_write_operations',
    'supplier_write_operations'
  ]) as table_name
), table_check as (
  select count(*)::int as required_count,
         count(*) filter (
           where exists (
             select 1 from information_schema.tables t
             where t.table_schema='lihen_private' and t.table_name=r.table_name
           )
         )::int as present_count
  from required_tables r
), required_functions as (
  select * from (values
    ('create_product_controlled','p_operation_key text'),
    ('update_product_controlled','p_operation_key text'),
    ('change_product_sale_price_controlled','p_operation_key text'),
    ('record_inventory_adjustment_controlled','p_operation_key text'),
    ('create_order_draft_controlled','p_operation_key text'),
    ('confirm_order_controlled','p_operation_key text'),
    ('cancel_order_controlled','p_operation_key text'),
    ('create_purchase_draft_controlled','p_operation_key text'),
    ('confirm_purchase_controlled','p_operation_key text'),
    ('receive_purchase_controlled','p_operation_key text'),
    ('record_expense_controlled','p_operation_key text'),
    ('transfer_financial_funds_controlled','p_operation_key text'),
    ('create_supplier_controlled','p_operation_key text'),
    ('update_supplier_controlled','p_operation_key text')
  ) v(function_name,required_arg_fragment)
), function_check as (
  select count(*)::int as required_count,
         count(*) filter (
           where exists (
             select 1
             from pg_catalog.pg_proc p
             join pg_catalog.pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public'
               and p.proname=f.function_name
               and pg_get_function_identity_arguments(p.oid) like '%'||f.required_arg_fragment||'%'
           )
         )::int as present_count
  from required_functions f
), style as (
  select count(*)::int as active_products,
         count(*) filter(where visible_on_website)::int as visible_products
  from public.products
  where business_line='STYLE' and status='ACTIVE'
), p6 as (
  select status from lihen_private.phase_exit_gate_results where phase_code='6.0'
), p5 as (
  select * from lihen_private.phase5_final_closure_audit limit 1
)
select
  case when
    (select status from p6)='PASS'
    and tc.present_count=tc.required_count
    and fc.present_count=fc.required_count
    and s.visible_products=0
    and p5.visual_regression_failed=0
  then 'PASS' else 'BLOCKED' end as readiness_status,
  tc.required_count as required_operation_tables,
  tc.present_count as present_operation_tables,
  fc.required_count as required_controlled_functions,
  fc.present_count as present_controlled_functions,
  s.active_products as style_active_products,
  s.visible_products as style_visible_products,
  p5.visual_regression_failed,
  jsonb_build_object(
    'operationalization_contract', jsonb_build_array(
      'OWNER_ADMIN_CONTROLLED_ENTRY_POINTS',
      'IDEMPOTENT_OPERATION_KEYS',
      'AUDITABLE_RESULT_SNAPSHOTS',
      'NO_DIRECT_TABLE_WRITES_FROM_UI',
      'STYLE_REMAINS_HIDDEN',
      'NO_PRODUCTION_WRITES_FROM_PHASE6_1'
    ),
    'next_subgates', jsonb_build_array(
      '6.1A_CONTROL_CENTER_OPERATION_CATALOG',
      '6.1B_DRY_RUN_AND_CONFIRMATION_FLOW',
      '6.1C_OPERATION_AUDIT_TIMELINE'
    )
  ) as contract
from table_check tc cross join function_check fc cross join style s cross join p5;

revoke all on lihen_private.phase6_1_controlled_operationalization_readiness from public,anon,authenticated;
grant select on lihen_private.phase6_1_controlled_operationalization_readiness to postgres;

create or replace function public.get_phase6_1_controlled_operationalization_readiness_controlled()
returns setof lihen_private.phase6_1_controlled_operationalization_readiness
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
  ) then raise exception using errcode='42501',message='LIHEN_PHASE6_1_READ_FORBIDDEN'; end if;
  return query select * from lihen_private.phase6_1_controlled_operationalization_readiness;
end;$$;

revoke all on function public.get_phase6_1_controlled_operationalization_readiness_controlled() from public,anon;
grant execute on function public.get_phase6_1_controlled_operationalization_readiness_controlled() to authenticated,postgres;

insert into lihen_private.phase_exit_gate_results(
  phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at
)
select
  '6.1',
  case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,
  'PHASE6_1_CONTROLLED_OPERATIONALIZATION_FOUNDATION_V1',
  jsonb_build_object(
    'required_operation_tables',r.required_operation_tables,
    'present_operation_tables',r.present_operation_tables,
    'required_controlled_functions',r.required_controlled_functions,
    'present_controlled_functions',r.present_controlled_functions,
    'style_active_products',r.style_active_products,
    'style_visible_products',r.style_visible_products,
    'visual_regression_failed',r.visual_regression_failed,
    'contract',r.contract
  ),
  '[]'::jsonb,
  'FASE 6.1 foundation only. No operational mutation executed; establishes controlled entry-point readiness and next operational subgates.',
  now()
from lihen_private.phase6_1_controlled_operationalization_readiness r
on conflict (phase_code) do update
set status=excluded.status,
    gate_version=excluded.gate_version,
    metrics=excluded.metrics,
    accepted_waivers=excluded.accepted_waivers,
    notes=excluded.notes,
    evaluated_at=excluded.evaluated_at;
