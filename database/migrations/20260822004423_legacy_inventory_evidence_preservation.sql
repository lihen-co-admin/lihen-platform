create table if not exists lihen_private.legacy_inventory_balances (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references lihen_private.legacy_reconciliation_runs(id) on delete restrict,
  source_inventory_id text not null,
  source_product_id text not null,
  physical_stock integer not null,
  reserved_stock integer not null,
  pending_stock integer not null,
  available_stock integer not null,
  average_cost numeric,
  last_counted_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(run_id, source_inventory_id),
  unique(run_id, source_product_id),
  check (physical_stock >= 0),
  check (reserved_stock >= 0),
  check (pending_stock >= 0)
);

create table if not exists lihen_private.legacy_inventory_movement_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references lihen_private.legacy_reconciliation_runs(id) on delete restrict,
  source_movement_id text not null,
  source_inventory_id text not null,
  movement_type text not null,
  quantity integer not null,
  physical_before integer,
  physical_after integer,
  reserved_before integer,
  reserved_after integer,
  unit_cost numeric,
  source_order_id text,
  source_supplier_request_id text,
  reason text,
  occurred_at timestamptz not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(run_id, source_movement_id)
);

create index if not exists legacy_inventory_balances_run_product_idx
  on lihen_private.legacy_inventory_balances(run_id, source_product_id);
create index if not exists legacy_inventory_movement_events_run_inventory_idx
  on lihen_private.legacy_inventory_movement_events(run_id, source_inventory_id, occurred_at);

create trigger legacy_inventory_balances_immutable
before update or delete on lihen_private.legacy_inventory_balances
for each row execute function lihen_private.prevent_immutable_row_mutation();

create trigger legacy_inventory_movement_events_immutable
before update or delete on lihen_private.legacy_inventory_movement_events
for each row execute function lihen_private.prevent_immutable_row_mutation();

revoke all on table lihen_private.legacy_inventory_balances from public, anon, authenticated;
revoke all on table lihen_private.legacy_inventory_movement_events from public, anon, authenticated;
grant select, insert on lihen_private.legacy_inventory_balances to service_role;
grant select, insert on lihen_private.legacy_inventory_movement_events to service_role;
