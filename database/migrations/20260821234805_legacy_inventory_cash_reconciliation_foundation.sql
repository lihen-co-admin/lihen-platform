create table if not exists lihen_private.legacy_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null check (btrim(source_name) <> ''),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_kind text not null check (source_kind in ('INVENTORY','MOVEMENTS','CASH_LEDGER','MIXED','OTHER')),
  source_row_count integer check (source_row_count is null or source_row_count >= 0),
  status text not null default 'DRY_RUN' check (status in ('DRY_RUN','REVIEWED','APPROVED','CUTOVER','REJECTED')),
  notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  cutover_at timestamptz
);

create index if not exists legacy_reconciliation_runs_source_sha256_idx
  on lihen_private.legacy_reconciliation_runs(source_sha256);

create table if not exists lihen_private.legacy_product_reconciliation (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references lihen_private.legacy_reconciliation_runs(id) on delete restrict,
  source_sheet text,
  source_row_key text not null check (btrim(source_row_key) <> ''),
  legacy_sku text,
  legacy_catalog_code text,
  legacy_name text,
  legacy_business_line text,
  legacy_brand text,
  legacy_category text,
  legacy_stock_actual integer,
  legacy_stock_reserved integer,
  legacy_stock_pending integer,
  legacy_cost numeric check (legacy_cost is null or legacy_cost >= 0),
  legacy_sale_price numeric check (legacy_sale_price is null or legacy_sale_price >= 0),
  canonical_product_id uuid references public.products(id) on delete restrict,
  match_status text not null check (match_status in ('MATCHED','PROBABLE_MATCH','UNMATCHED','CONFLICT','LEGACY_ONLY')),
  match_method text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, source_sheet, source_row_key)
);

create index if not exists legacy_product_reconciliation_product_idx
  on lihen_private.legacy_product_reconciliation(canonical_product_id);
create index if not exists legacy_product_reconciliation_status_idx
  on lihen_private.legacy_product_reconciliation(run_id, match_status);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  bucket text not null check (bucket in ('ON_HAND','RESERVED','PENDING_IN')),
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null check (btrim(reason) <> ''),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source_run_id uuid references lihen_private.legacy_reconciliation_runs(id) on delete restrict,
  source_row_key text,
  external_reference text,
  notes text,
  check ((source_run_id is null and source_row_key is null) or source_run_id is not null)
);

create index if not exists inventory_movements_product_occurred_idx
  on public.inventory_movements(product_id, occurred_at, id);
create index if not exists inventory_movements_source_run_idx
  on public.inventory_movements(source_run_id) where source_run_id is not null;

alter table public.inventory_movements enable row level security;

create or replace function lihen_private.prevent_immutable_row_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Immutable ledger rows cannot be updated or deleted; record a compensating entry instead.';
end;
$$;

revoke all on function lihen_private.prevent_immutable_row_mutation() from public;

create trigger inventory_movements_immutable
before update or delete on public.inventory_movements
for each row execute function lihen_private.prevent_immutable_row_mutation();

create or replace view public.inventory_stock
with (security_invoker = true)
as
select
  p.id as product_id,
  coalesce(sum(m.quantity_delta) filter (where m.bucket = 'ON_HAND'), 0)::bigint as stock_on_hand,
  coalesce(sum(m.quantity_delta) filter (where m.bucket = 'RESERVED'), 0)::bigint as stock_reserved,
  coalesce(sum(m.quantity_delta) filter (where m.bucket = 'PENDING_IN'), 0)::bigint as stock_pending,
  (
    coalesce(sum(m.quantity_delta) filter (where m.bucket = 'ON_HAND'), 0)
    - coalesce(sum(m.quantity_delta) filter (where m.bucket = 'RESERVED'), 0)
  )::bigint as stock_available
from public.products p
left join public.inventory_movements m on m.product_id = p.id
group by p.id;

create table if not exists lihen_private.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  entry_type text not null check (entry_type in ('SALE','PURCHASE','EXPENSE','INCOME','REFUND','ADJUSTMENT','OTHER')),
  payment_channel text not null check (payment_channel in ('CASH','NEQUI','TRANSFER','CARD','OTHER')),
  amount_signed numeric not null check (amount_signed <> 0),
  currency text not null default 'COP' check (currency = 'COP'),
  description text not null check (btrim(description) <> ''),
  product_id uuid references public.products(id) on delete restrict,
  source_run_id uuid references lihen_private.legacy_reconciliation_runs(id) on delete restrict,
  source_row_key text,
  external_reference text,
  evidence jsonb not null default '{}'::jsonb,
  check ((source_run_id is null and source_row_key is null) or source_run_id is not null)
);

create index if not exists financial_ledger_entries_occurred_idx
  on lihen_private.financial_ledger_entries(occurred_at, id);
create index if not exists financial_ledger_entries_product_idx
  on lihen_private.financial_ledger_entries(product_id) where product_id is not null;
create index if not exists financial_ledger_entries_source_run_idx
  on lihen_private.financial_ledger_entries(source_run_id) where source_run_id is not null;

create trigger financial_ledger_entries_immutable
before update or delete on lihen_private.financial_ledger_entries
for each row execute function lihen_private.prevent_immutable_row_mutation();

revoke all on table lihen_private.legacy_reconciliation_runs from public, anon, authenticated;
revoke all on table lihen_private.legacy_product_reconciliation from public, anon, authenticated;
revoke all on table lihen_private.financial_ledger_entries from public, anon, authenticated;
revoke all on table public.inventory_movements from public, anon, authenticated;
revoke all on public.inventory_stock from public, anon, authenticated;

grant select, insert on lihen_private.legacy_reconciliation_runs to service_role;
grant select, insert on lihen_private.legacy_product_reconciliation to service_role;
grant select, insert on lihen_private.financial_ledger_entries to service_role;
grant select, insert on public.inventory_movements to service_role;
grant select on public.inventory_stock to service_role;
