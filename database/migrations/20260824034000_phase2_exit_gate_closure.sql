with phase2_metrics as (
  select
    (select count(*) from public.operational_integrity_checks) as integrity_check_count,
    (select count(*) from public.operational_integrity_checks where status <> 'PASS') as integrity_failure_count,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname = any(array[
      'create_product_controlled','update_product_controlled','change_product_sale_price_controlled',
      'record_inventory_adjustment_controlled','create_supplier_controlled','update_supplier_controlled',
      'create_purchase_draft_controlled','confirm_purchase_controlled','receive_purchase_controlled',
      'create_order_draft_controlled','confirm_order_controlled','cancel_order_controlled',
      'create_pos_sale_controlled','complete_order_sale_controlled','create_financial_account_controlled',
      'record_expense_controlled','transfer_financial_funds_controlled','reverse_financial_movement_controlled',
      'record_cash_closure_controlled'
    ])) as controlled_operation_count,
    (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relname = any(array[
        'products','product_images','suppliers','supplier_products','purchases','purchase_items',
        'orders','order_items','sales','sale_items','financial_accounts','financial_movements',
        'cash_closures','operational_audit_log','domain_events'
      ]) and c.relrowsecurity = false) as critical_public_tables_without_rls,
    (select count(*) from public.profiles where authorization_status='ACTIVE' and role_code='OWNER') as active_owner_count,
    (select count(*) from public.operational_audit_log) as audit_row_count,
    (select count(*) from public.domain_events) as domain_event_count,
    (select count(*) from public.products) as product_count,
    (select count(*) from public.suppliers) as supplier_count,
    (select count(*) from public.purchases) as purchase_count,
    (select count(*) from public.orders) as order_count,
    (select count(*) from public.sales) as sale_count,
    (select count(*) from public.financial_accounts) as financial_account_count,
    (select count(*) from public.financial_movements) as financial_movement_count,
    (select count(*) from public.cash_closures) as cash_closure_count
)
insert into lihen_private.phase_exit_gate_results (
  phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at
)
select
  '2',
  case when integrity_check_count >= 11
         and integrity_failure_count = 0
         and controlled_operation_count = 19
         and critical_public_tables_without_rls = 0
         and active_owner_count >= 1
         and audit_row_count > 0
         and domain_event_count > 0
       then 'PASS' else 'BLOCKED' end,
  'PHASE2_CAPABILITY_INTEGRITY_EXIT_GATE_V1',
  jsonb_build_object(
    'integrity_check_count', integrity_check_count,
    'integrity_failure_count', integrity_failure_count,
    'controlled_operation_count', controlled_operation_count,
    'critical_public_tables_without_rls', critical_public_tables_without_rls,
    'active_owner_count', active_owner_count,
    'audit_row_count', audit_row_count,
    'domain_event_count', domain_event_count,
    'products', product_count,
    'suppliers', supplier_count,
    'purchases', purchase_count,
    'orders', order_count,
    'sales', sale_count,
    'financial_accounts', financial_account_count,
    'financial_movements', financial_movement_count,
    'cash_closures', cash_closure_count,
    'non_blocking_debt', jsonb_build_array('PHASE2_FULL_BROWSER_E2E_RECONFIRMATION_DEFERRED_TO_PHASE7')
  ),
  '[]'::jsonb,
  'Phase 2 capability/integrity gate. Core controlled operations, RLS, operational integrity, authorization and auditability are present and healthy. A complete browser-level production rehearsal remains a Phase 7 go-live concern and is classified as non-blocking debt, not as evidence that persisted sales or cash closures must exist in DEV.',
  now()
from phase2_metrics
on conflict (phase_code) do update set
  status=excluded.status,
  gate_version=excluded.gate_version,
  metrics=excluded.metrics,
  accepted_waivers=excluded.accepted_waivers,
  notes=excluded.notes,
  evaluated_at=excluded.evaluated_at;
