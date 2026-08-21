-- FASE 1.8.1 — PENDING / NO EJECUTAR EN PROD
-- Expand migration: crea brands sin borrar ni renombrar products.brand.
-- PRECONDICIÓN: revisar esquema DEV y asignar numeración real de migración.

begin;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  logo_url text null,
  description text null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_name_not_blank check (length(trim(name)) > 0),
  constraint brands_normalized_name_not_blank check (length(trim(normalized_name)) > 0),
  constraint brands_status_valid check (status in ('ACTIVE','INACTIVE'))
);

-- NO unique todavía: primero se deben resolver colisiones de normalización en DEV.
create index if not exists idx_brands_normalized_name
  on public.brands (normalized_name);

alter table public.brands enable row level security;

commit;
