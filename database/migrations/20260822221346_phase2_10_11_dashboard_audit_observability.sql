create table if not exists public.operational_audit_log (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  operation_type text not null,
  operation_key text not null,
  actor_id uuid not null,
  entity_type text not null,
  entity_id uuid,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint operational_audit_log_module_key_unique unique (module, operation_key),
  constraint operational_audit_log_module_not_blank check (length(btrim(module)) > 0),
  constraint operational_audit_log_operation_not_blank check (length(btrim(operation_type)) > 0),
  constraint operational_audit_log_key_not_blank check (length(btrim(operation_key)) > 0)
);

alter table public.operational_audit_log enable row level security;
revoke all on public.operational_audit_log from anon, authenticated;
grant select on public.operational_audit_log to authenticated;

drop policy if exists operational_audit_log_admin_read on public.operational_audit_log;
create policy operational_audit_log_admin_read
on public.operational_audit_log
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.authorization_status = 'ACTIVE'
      and p.role_code = any (array['OWNER'::text,'ADMIN'::text])
  )
);

create or replace function lihen_private.capture_operational_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, lihen_private
as $$
declare
  row_data jsonb := to_jsonb(new);
  v_module text;
  v_entity_type text;
  v_entity_id uuid;
begin
  v_module := case tg_table_name
    when 'product_write_operations' then 'PRODUCTS'
    when 'inventory_write_operations' then 'INVENTORY'
    when 'supplier_write_operations' then 'SUPPLIERS'
    when 'purchase_write_operations' then 'PURCHASES'
    when 'order_write_operations' then 'ORDERS'
    when 'sale_write_operations' then 'SALES'
    when 'financial_write_operations' then 'FINANCE'
    else upper(tg_table_name)
  end;

  v_entity_type := case tg_table_name
    when 'product_write_operations' then 'PRODUCT'
    when 'inventory_write_operations' then 'PRODUCT'
    when 'supplier_write_operations' then 'SUPPLIER'
    when 'purchase_write_operations' then 'PURCHASE'
    when 'order_write_operations' then 'ORDER'
    when 'sale_write_operations' then 'SALE'
    when 'financial_write_operations' then 'FINANCIAL'
    else 'UNKNOWN'
  end;

  v_entity_id := coalesce(
    nullif(row_data->>'product_id','')::uuid,
    nullif(row_data->>'supplier_id','')::uuid,
    nullif(row_data->>'purchase_id','')::uuid,
    nullif(row_data->>'order_id','')::uuid,
    nullif(row_data->>'sale_id','')::uuid,
    nullif(row_data->>'account_id','')::uuid,
    nullif(row_data->>'movement_id','')::uuid
  );

  insert into public.operational_audit_log(
    module, operation_type, operation_key, actor_id, entity_type, entity_id, occurred_at, metadata
  ) values (
    v_module,
    new.operation_type,
    new.operation_key,
    new.actor_id,
    v_entity_type,
    v_entity_id,
    coalesce(new.created_at, now()),
    jsonb_build_object('source_table', tg_table_name)
  )
  on conflict (module, operation_key) do nothing;

  return new;
end;
$$;

revoke all on function lihen_private.capture_operational_audit() from public, anon, authenticated;

DO $$
declare
  t text;
begin
  foreach t in array array[
    'product_write_operations',
    'inventory_write_operations',
    'supplier_write_operations',
    'purchase_write_operations',
    'order_write_operations',
    'sale_write_operations',
    'financial_write_operations'
  ]
  loop
    execute format('drop trigger if exists %I on lihen_private.%I', 'trg_capture_operational_audit_' || t, t);
    execute format(
      'create trigger %I after insert on lihen_private.%I for each row execute function lihen_private.capture_operational_audit()',
      'trg_capture_operational_audit_' || t,
      t
    );
  end loop;
end $$;

create or replace view public.operational_dashboard_summary
with (security_invoker = true)
as
select
  (select count(*) from public.products) as products_total,
  (select count(*) from public.products where status = 'ACTIVE') as products_active,
  (select coalesce(sum(stock_on_hand),0) from public.inventory_stock) as stock_on_hand_total,
  (select coalesce(sum(stock_reserved),0) from public.inventory_stock) as stock_reserved_total,
  (select coalesce(sum(stock_pending),0) from public.inventory_stock) as stock_pending_total,
  (select coalesce(sum(stock_available),0) from public.inventory_stock) as stock_available_total,
  (select count(*) from public.suppliers where status = 'ACTIVE') as suppliers_active,
  (select count(*) from public.purchases where status in ('DRAFT','CONFIRMED','PARTIALLY_RECEIVED')) as purchases_open,
  (select count(*) from public.orders where status in ('DRAFT','CONFIRMED','PREPARING','READY')) as orders_open,
  (select count(*) from public.sales where status = 'COMPLETED') as sales_completed,
  (select coalesce(sum(total_amount),0) from public.sales where status = 'COMPLETED') as sales_total_cop,
  (select count(*) from public.financial_accounts where status = 'ACTIVE') as financial_accounts_active,
  (select coalesce(sum(balance),0) from public.financial_account_balances where status = 'ACTIVE') as financial_balance_total_cop,
  (select coalesce(sum(issue_count),0) from public.operational_integrity_checks where status <> 'PASS') as integrity_issue_count,
  (select count(*) from public.operational_audit_log) as audited_operations;

grant select on public.operational_dashboard_summary to authenticated;

comment on table public.operational_audit_log is 'Append-only administrative audit projection sourced from controlled write operation ledgers.';
comment on view public.operational_dashboard_summary is 'Read-only operational snapshot for LIHEN Control Center Phase 2 dashboard.';
