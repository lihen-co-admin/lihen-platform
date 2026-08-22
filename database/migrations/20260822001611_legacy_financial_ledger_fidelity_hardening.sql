alter table lihen_private.financial_ledger_entries
  add column if not exists source_system text,
  add column if not exists source_entry_id text,
  add column if not exists legacy_status text,
  add column if not exists reversal_of_source_entry_id text,
  add column if not exists reporting_excluded boolean not null default false,
  add column if not exists reporting_exclusion_reason text,
  add column if not exists balance_before numeric,
  add column if not exists balance_after numeric,
  add column if not exists legacy_account_code text;

create unique index if not exists financial_ledger_entries_source_identity_uidx
  on lihen_private.financial_ledger_entries(source_system, source_entry_id)
  where source_system is not null and source_entry_id is not null;

create table if not exists lihen_private.legacy_financial_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references lihen_private.legacy_reconciliation_runs(id) on delete restrict,
  source_account_id text not null,
  account_code text not null,
  account_name text not null,
  account_type text not null,
  currency text not null default 'COP' check (currency = 'COP'),
  initial_balance numeric not null,
  initial_balance_date date,
  current_balance numeric not null,
  active boolean not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, source_account_id)
);

revoke all on table lihen_private.legacy_financial_account_snapshots from public, anon, authenticated;
grant select, insert on lihen_private.legacy_financial_account_snapshots to service_role;
