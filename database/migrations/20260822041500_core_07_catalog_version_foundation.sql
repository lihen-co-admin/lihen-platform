-- CORE 07 — Versioned catalog foundation.
-- Creates empty versioning structures only. No catalog is activated or populated here.

create table if not exists public.catalog_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  version_label text not null,
  source_type text not null,
  status text not null default 'DRAFT',
  effective_at timestamptz,
  source_reference text,
  created_at timestamptz not null default now(),
  constraint catalog_versions_code_not_blank check (length(btrim(code)) > 0),
  constraint catalog_versions_title_not_blank check (length(btrim(title)) > 0),
  constraint catalog_versions_label_not_blank check (length(btrim(version_label)) > 0),
  constraint catalog_versions_source_type_allowed check (source_type in ('PDF','WEB')),
  constraint catalog_versions_status_allowed check (status in ('DRAFT','ACTIVE','ARCHIVED')),
  constraint catalog_versions_code_unique unique (code)
);

create table if not exists public.catalog_entries (
  id uuid primary key default gen_random_uuid(),
  catalog_version_id uuid not null references public.catalog_versions(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name_snapshot text not null,
  sale_price_snapshot numeric not null,
  visible boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint catalog_entries_name_not_blank check (length(btrim(product_name_snapshot)) > 0),
  constraint catalog_entries_price_nonnegative check (sale_price_snapshot >= 0),
  constraint catalog_entries_version_product_unique unique (catalog_version_id, product_id)
);

create index if not exists catalog_entries_product_id_idx on public.catalog_entries(product_id);
create index if not exists catalog_entries_version_sort_idx on public.catalog_entries(catalog_version_id, sort_order, id);

alter table public.catalog_versions enable row level security;
alter table public.catalog_entries enable row level security;

revoke all on public.catalog_versions from anon, authenticated;
revoke all on public.catalog_entries from anon, authenticated;

grant select on public.catalog_versions to authenticated;
grant select on public.catalog_entries to authenticated;

create policy catalog_versions_admin_read on public.catalog_versions
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  )
);

create policy catalog_entries_admin_read on public.catalog_entries
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  )
);

comment on table public.catalog_versions is
  'Versioned LIHEN catalog headers. Activation/population occurs only through later controlled workflows.';
comment on table public.catalog_entries is
  'Immutable-intent catalog snapshots linked to Product Master; no rows are created by the foundation migration.';
