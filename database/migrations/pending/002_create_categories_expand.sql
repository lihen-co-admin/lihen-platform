-- FASE 1.8.1 — PENDING / NO EJECUTAR EN PROD
-- Expand migration: crea categories jerárquica sin borrar category/subcategory legacy.
-- PRECONDICIÓN: revisar esquema DEV y asignar numeración real de migración.

begin;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  slug text null,
  business_line text null,
  parent_id uuid null references public.categories(id) on delete restrict,
  status text not null default 'ACTIVE',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (length(trim(name)) > 0),
  constraint categories_normalized_name_not_blank check (length(trim(normalized_name)) > 0),
  constraint categories_status_valid check (status in ('ACTIVE','INACTIVE')),
  constraint categories_no_self_parent check (parent_id is null or parent_id <> id)
);

create index if not exists idx_categories_parent_id on public.categories(parent_id);
create index if not exists idx_categories_normalized_name on public.categories(normalized_name);

alter table public.categories enable row level security;

commit;
