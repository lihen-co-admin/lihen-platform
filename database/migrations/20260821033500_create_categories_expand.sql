create table public.categories (
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
  constraint categories_name_not_blank check (btrim(name) <> ''),
  constraint categories_normalized_name_not_blank check (btrim(normalized_name) <> ''),
  constraint categories_status_valid check (status in ('ACTIVE','INACTIVE')),
  constraint categories_no_self_parent check (parent_id is null or parent_id <> id)
);
create index categories_parent_id_idx on public.categories(parent_id);
create index categories_normalized_name_idx on public.categories(normalized_name);
alter table public.categories enable row level security;
revoke all on table public.categories from anon;
revoke insert, update, delete, truncate, references, trigger on table public.categories from authenticated;
grant select on table public.categories to authenticated;
create policy categories_authenticated_read on public.categories for select to authenticated using (true);
comment on table public.categories is 'Canonical hierarchical LIHEN categories. FASE 1.8.1 expand-only; writes remain blocked.';
