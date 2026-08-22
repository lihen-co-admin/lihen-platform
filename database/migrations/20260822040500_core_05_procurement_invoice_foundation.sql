-- CORE 05 — Canonical purchases and supplier invoices foundation.
-- No legacy purchase/invoice rows are imported by this migration.

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'DRAFT',
  purchase_date date,
  expected_date date,
  received_at timestamptz,
  notes text,
  is_historical boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchases_number_not_blank check (length(btrim(purchase_number)) > 0),
  constraint purchases_status_allowed check (
    status in ('DRAFT','CONFIRMED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')
  ),
  constraint purchases_number_unique unique (purchase_number)
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_requested integer not null,
  quantity_received integer not null default 0,
  quoted_unit_cost numeric,
  final_unit_cost numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_items_quantity_requested_positive check (quantity_requested > 0),
  constraint purchase_items_quantity_received_nonnegative check (quantity_received >= 0),
  constraint purchase_items_quoted_cost_nonnegative check (quoted_unit_cost is null or quoted_unit_cost >= 0),
  constraint purchase_items_final_cost_nonnegative check (final_unit_cost is null or final_unit_cost >= 0),
  constraint purchase_items_purchase_product_unique unique (purchase_id, product_id)
);

create table if not exists public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete restrict,
  invoice_number text not null,
  invoice_date date,
  due_date date,
  payment_status text not null default 'PENDING',
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  freight_amount numeric not null default 0,
  total_amount numeric not null default 0,
  amount_paid numeric not null default 0,
  balance_due numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_invoices_number_not_blank check (length(btrim(invoice_number)) > 0),
  constraint supplier_invoices_payment_status_allowed check (
    payment_status in ('PENDING','PARTIAL','PAID','CANCELLED')
  ),
  constraint supplier_invoices_amounts_nonnegative check (
    subtotal >= 0 and discount_amount >= 0 and tax_amount >= 0 and freight_amount >= 0
    and total_amount >= 0 and amount_paid >= 0 and balance_due >= 0
  ),
  constraint supplier_invoices_supplier_number_unique unique (supplier_id, invoice_number)
);

create index if not exists purchases_supplier_id_idx on public.purchases(supplier_id);
create index if not exists purchase_items_product_id_idx on public.purchase_items(product_id);
create index if not exists supplier_invoices_supplier_id_idx on public.supplier_invoices(supplier_id);
create index if not exists supplier_invoices_purchase_id_idx on public.supplier_invoices(purchase_id)
  where purchase_id is not null;

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.supplier_invoices enable row level security;

revoke all on public.purchases from anon, authenticated;
revoke all on public.purchase_items from anon, authenticated;
revoke all on public.supplier_invoices from anon, authenticated;

grant select on public.purchases to authenticated;
grant select on public.purchase_items to authenticated;
grant select on public.supplier_invoices to authenticated;

create policy purchases_admin_read on public.purchases
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  )
);

create policy purchase_items_admin_read on public.purchase_items
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  )
);

create policy supplier_invoices_admin_read on public.supplier_invoices
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  )
);

comment on table public.purchases is
  'Canonical LIHEN purchase header. Legacy supplier requests are reconciled separately.';
comment on table public.purchase_items is
  'Canonical purchase lines linked to Product Master.';
comment on table public.supplier_invoices is
  'Canonical supplier invoice header; financial posting remains a separate concern.';
