-- ============================================================
-- LIHEN CUSTOMER MASTER — AUDIT TIMELINE INTEGRATION
--
-- Reuses the existing institutional audit architecture.
-- No new audit subsystem is introduced.
-- ============================================================


-- ============================================================
-- 1. EXTEND OPERATION AUDIT TIMELINE WITH CUSTOMERS
-- ============================================================

create or replace view
lihen_private.control_center_operation_audit_timeline
as

select
  'PRODUCTS'::text as domain_code,
  operation_type,
  operation_key,
  actor_id,
  product_id as entity_id,
  request_fingerprint,
  result_snapshot,
  created_at as occurred_at
from lihen_private.product_write_operations

union all

select
  'INVENTORY'::text,
  operation_type,
  operation_key,
  actor_id,
  product_id,
  request_fingerprint,
  result_snapshot,
  created_at
from lihen_private.inventory_write_operations

union all

select
  'ORDERS'::text,
  operation_type,
  operation_key,
  actor_id,
  order_id,
  request_fingerprint,
  result_snapshot,
  created_at
from lihen_private.order_write_operations

union all

select
  'PROCUREMENT'::text,
  operation_type,
  operation_key,
  actor_id,
  purchase_id,
  request_fingerprint,
  result_snapshot,
  created_at
from lihen_private.purchase_write_operations

union all

select
  'FINANCE'::text,
  operation_type,
  operation_key,
  actor_id,
  coalesce(
    account_id,
    movement_id
  ),
  request_fingerprint,
  result_snapshot,
  created_at
from lihen_private.financial_write_operations

union all

select
  'SUPPLIERS'::text,
  operation_type,
  operation_key,
  actor_id,
  supplier_id,
  request_fingerprint,
  result_snapshot,
  created_at
from lihen_private.supplier_write_operations

union all

select
  'CUSTOMERS'::text,
  operation_type,
  operation_key,
  actor_id,
  customer_id,
  request_fingerprint,
  result_snapshot,
  created_at
from lihen_private.customer_write_operations
;


revoke all
on lihen_private.control_center_operation_audit_timeline
from public, anon, authenticated;


grant select
on lihen_private.control_center_operation_audit_timeline
to postgres;


comment on view
lihen_private.control_center_operation_audit_timeline
is
  'Institutional read-only operation audit timeline. Customer Master reuses the same controlled-write audit model used by existing LIHEN domains.';


-- ============================================================
-- 2. READINESS VIEW
-- ============================================================

create or replace view
lihen_private.customer_master_audit_timeline_readiness
as

with customer_events as (
  select
    count(*)::bigint as customer_audit_rows
  from lihen_private.control_center_operation_audit_timeline
  where domain_code = 'CUSTOMERS'
),

functions as (
  select
    count(*)::integer as audit_read_functions
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname =
      'get_control_center_operation_audit_timeline_controlled'
)

select
  case
    when functions.audit_read_functions = 1
    then 'PASS'
    else 'BLOCKED'
  end as readiness_status,

  customer_events.customer_audit_rows,

  functions.audit_read_functions,

  jsonb_build_array(
    'CUSTOMERS_DOMAIN_INCLUDED',
    'EXISTING_OPERATION_TIMELINE_REUSED',
    'NO_SECOND_AUDIT_SYSTEM',
    'READ_ONLY_TIMELINE',
    'OWNER_ADMIN_CONTROLLED_READ',
    'NO_BUSINESS_MUTATION'
  ) as contract

from customer_events
cross join functions
;


revoke all
on lihen_private.customer_master_audit_timeline_readiness
from public, anon, authenticated;


grant select
on lihen_private.customer_master_audit_timeline_readiness
to postgres;


comment on view
lihen_private.customer_master_audit_timeline_readiness
is
  'Readiness evidence for Customer Master integration with the existing institutional operation audit timeline.';
