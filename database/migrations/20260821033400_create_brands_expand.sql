create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  logo_url text null,
  description text null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_name_not_blank check (btrim(name) <> ''),
  constraint brands_normalized_name_not_blank check (btrim(normalized_name) <> ''),
  constraint brands_status_valid check (status in ('ACTIVE','INACTIVE'))
);
create index brands_normalized_name_idx on public.brands(normalized_name);
alter table public.brands enable row level security;
revoke all on table public.brands from anon;
revoke insert, update, delete, truncate, references, trigger on table public.brands from authenticated;
grant select on table public.brands to authenticated;
create policy brands_authenticated_read on public.brands for select to authenticated using (true);
comment on table public.brands is 'Canonical LIHEN brands. FASE 1.8.1 expand-only; writes remain blocked.';
