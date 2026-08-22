-- CORE 03 — Canonical supplier foundation.
-- Creates the supplier identity and supplier-product relationship without importing
-- or guessing legacy identities. Legacy reconciliation is deliberately separate.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  normalized_name text not null,
  contact_name text,
  whatsapp text,
  email text,
  city text,
  average_delivery_days integer,
  notes text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_business_name_not_blank check (length(btrim(business_name)) > 0),
  constraint suppliers_normalized_name_not_blank check (length(btrim(normalized_name)) > 0),
  constraint suppliers_average_delivery_days_nonnegative check (
    average_delivery_days is null or average_delivery_days >= 0
  ),
  constraint suppliers_status_allowed check (status in ('ACTIVE', 'INACTIVE')),
  constraint suppliers_normalized_name_unique unique (normalized_name)
);

create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  supplier_reference text,
  last_cost numeric,
  last_confirmed_at timestamptz,
  usual_delivery_days integer,
  preferred boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_products_last_cost_nonnegative check (last_cost is null or last_cost >= 0),
  constraint supplier_products_delivery_days_nonnegative check (
    usual_delivery_days is null or usual_delivery_days >= 0
  ),
  constraint supplier_products_supplier_product_unique unique (supplier_id, product_id)
);

create index if not exists supplier_products_product_id_idx
  on public.supplier_products(product_id);

create index if not exists supplier_products_supplier_id_idx
  on public.supplier_products(supplier_id);

alter table public.suppliers enable row level security;
alter table public.supplier_products enable row level security;

revoke all on public.suppliers from anon, authenticated;
revoke all on public.supplier_products from anon, authenticated;

grant select on public.suppliers to authenticated;
grant select on public.supplier_products to authenticated;

drop policy if exists suppliers_admin_read on public.suppliers;
create policy suppliers_admin_read
on public.suppliers
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER')
  )
);

drop policy if exists supplier_products_admin_read on public.supplier_products;
create policy supplier_products_admin_read
on public.supplier_products
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER')
  )
);

comment on table public.suppliers is
  'Canonical LIHEN supplier identities. No legacy supplier is imported by this migration.';
comment on table public.supplier_products is
  'Canonical relationship between suppliers and Product Master identities.';
