create table if not exists lihen_private.control_center_operation_catalog (
  operation_code text primary key,
  function_name text not null unique,
  domain_code text not null,
  risk_level text not null check (risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')),
  action_kind text not null,
  requires_confirmation boolean not null default true,
  execution_enabled boolean not null default false,
  owner_admin_only boolean not null default true,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on lihen_private.control_center_operation_catalog from public, anon, authenticated;
grant select on lihen_private.control_center_operation_catalog to postgres;

insert into lihen_private.control_center_operation_catalog(
  operation_code,function_name,domain_code,risk_level,action_kind,requires_confirmation,execution_enabled,owner_admin_only,description
) values
('PRODUCT_CREATE','create_product_controlled','PRODUCTS','HIGH','CREATE',true,false,true,'Crear un producto canónico mediante el entry point controlado.'),
('PRODUCT_UPDATE','update_product_controlled','PRODUCTS','HIGH','UPDATE',true,false,true,'Actualizar identidad y atributos canónicos mediante el entry point controlado.'),
('PRODUCT_PRICE_CHANGE','change_product_sale_price_controlled','PRODUCTS','CRITICAL','PRICE_CHANGE',true,false,true,'Cambiar precio de venta conservando historial append-only.'),
('INVENTORY_ADJUST','record_inventory_adjustment_controlled','INVENTORY','CRITICAL','ADJUST',true,false,true,'Registrar un ajuste de inventario auditable.'),
('ORDER_CREATE_DRAFT','create_order_draft_controlled','ORDERS','MEDIUM','CREATE_DRAFT',true,false,true,'Crear un pedido en estado borrador.'),
('ORDER_CONFIRM','confirm_order_controlled','ORDERS','HIGH','CONFIRM',true,false,true,'Confirmar un pedido existente.'),
('ORDER_CANCEL','cancel_order_controlled','ORDERS','HIGH','CANCEL',true,false,true,'Cancelar un pedido con razón explícita.'),
('PURCHASE_CREATE_DRAFT','create_purchase_draft_controlled','PROCUREMENT','MEDIUM','CREATE_DRAFT',true,false,true,'Crear una compra en estado borrador.'),
('PURCHASE_CONFIRM','confirm_purchase_controlled','PROCUREMENT','HIGH','CONFIRM',true,false,true,'Confirmar una compra existente.'),
('PURCHASE_RECEIVE','receive_purchase_controlled','PROCUREMENT','CRITICAL','RECEIVE',true,false,true,'Recibir una compra y registrar sus líneas controladas.'),
('FINANCE_EXPENSE','record_expense_controlled','FINANCE','CRITICAL','EXPENSE',true,false,true,'Registrar un gasto financiero auditable.'),
('FINANCE_TRANSFER','transfer_financial_funds_controlled','FINANCE','CRITICAL','TRANSFER',true,false,true,'Transferir fondos entre cuentas mediante operación controlada.'),
('SUPPLIER_CREATE','create_supplier_controlled','SUPPLIERS','MEDIUM','CREATE',true,false,true,'Crear un proveedor mediante entry point controlado.'),
('SUPPLIER_UPDATE','update_supplier_controlled','SUPPLIERS','MEDIUM','UPDATE',true,false,true,'Actualizar un proveedor mediante entry point controlado.')
on conflict (operation_code) do update set
  function_name=excluded.function_name,
  domain_code=excluded.domain_code,
  risk_level=excluded.risk_level,
  action_kind=excluded.action_kind,
  requires_confirmation=excluded.requires_confirmation,
  execution_enabled=excluded.execution_enabled,
  owner_admin_only=excluded.owner_admin_only,
  description=excluded.description,
  updated_at=now();

create or replace view lihen_private.control_center_operation_catalog_readiness as
with checks as (
  select
    count(*)::int as catalog_entries,
    count(*) filter(where execution_enabled=false)::int as execution_disabled_entries,
    count(*) filter(where owner_admin_only=true)::int as owner_admin_entries,
    count(*) filter(where requires_confirmation=true)::int as confirmation_entries,
    count(distinct domain_code)::int as domains,
    count(*) filter(where risk_level in ('HIGH','CRITICAL'))::int as sensitive_entries,
    count(*) filter(where exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=c.function_name
    ))::int as backing_functions_present
  from lihen_private.control_center_operation_catalog c
), style as (
  select count(*) filter(where status='ACTIVE')::int as active_products,
         count(*) filter(where status='ACTIVE' and visible_on_website)::int as visible_products
  from public.products where business_line='STYLE'
), p61 as (
  select status from lihen_private.phase_exit_gate_results where phase_code='6.1'
)
select
  case when (select status from p61)='PASS'
    and c.catalog_entries=14
    and c.execution_disabled_entries=14
    and c.owner_admin_entries=14
    and c.confirmation_entries=14
    and c.backing_functions_present=14
    and s.visible_products=0
  then 'PASS' else 'BLOCKED' end as readiness_status,
  c.catalog_entries,
  c.execution_disabled_entries,
  c.owner_admin_entries,
  c.confirmation_entries,
  c.domains,
  c.sensitive_entries,
  c.backing_functions_present,
  s.active_products as style_active_products,
  s.visible_products as style_visible_products
from checks c cross join style s;

revoke all on lihen_private.control_center_operation_catalog_readiness from public, anon, authenticated;
grant select on lihen_private.control_center_operation_catalog_readiness to postgres;

create or replace function public.get_control_center_operation_catalog_controlled()
returns table(
  operation_code text,
  function_name text,
  domain_code text,
  risk_level text,
  action_kind text,
  requires_confirmation boolean,
  execution_enabled boolean,
  owner_admin_only boolean,
  description text
)
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then raise exception using errcode='42501', message='LIHEN_OPERATION_CATALOG_READ_FORBIDDEN'; end if;
  return query
  select c.operation_code,c.function_name,c.domain_code,c.risk_level,c.action_kind,
         c.requires_confirmation,c.execution_enabled,c.owner_admin_only,c.description
  from lihen_private.control_center_operation_catalog c
  order by c.domain_code,c.risk_level desc,c.operation_code;
end;$$;

revoke all on function public.get_control_center_operation_catalog_controlled() from public, anon;
grant execute on function public.get_control_center_operation_catalog_controlled() to authenticated, postgres;

insert into lihen_private.phase_exit_gate_results(
  phase_code,status,gate_version,metrics,accepted_waivers,notes,evaluated_at
)
select
  '6.1A',
  case when r.readiness_status='PASS' then 'PASS' else 'BLOCKED' end,
  'PHASE6_1A_CONTROL_CENTER_OPERATION_CATALOG_FOUNDATION_V1',
  jsonb_build_object(
    'catalog_entries',r.catalog_entries,
    'execution_disabled_entries',r.execution_disabled_entries,
    'owner_admin_entries',r.owner_admin_entries,
    'confirmation_entries',r.confirmation_entries,
    'domains',r.domains,
    'sensitive_entries',r.sensitive_entries,
    'backing_functions_present',r.backing_functions_present,
    'style_active_products',r.style_active_products,
    'style_visible_products',r.style_visible_products,
    'contract',jsonb_build_array(
      'CATALOG_ONLY_NO_EXECUTION',
      'OWNER_ADMIN_READ_ONLY',
      'EXPLICIT_RISK_CLASSIFICATION',
      'CONFIRMATION_REQUIRED_BEFORE_FUTURE_EXECUTION',
      'NO_DIRECT_UI_TABLE_WRITES',
      'STYLE_REMAINS_HIDDEN',
      'NO_PRODUCTION_WRITES'
    )
  ),
  '[]'::jsonb,
  'FASE 6.1A catalog foundation only. All catalog operations remain execution_enabled=false; no business mutation is executed.',
  now()
from lihen_private.control_center_operation_catalog_readiness r
on conflict (phase_code) do update set
 status=excluded.status,
 gate_version=excluded.gate_version,
 metrics=excluded.metrics,
 accepted_waivers=excluded.accepted_waivers,
 notes=excluded.notes,
 evaluated_at=excluded.evaluated_at;
