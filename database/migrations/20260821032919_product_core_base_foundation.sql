create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text null,
  catalog_code text null,
  name text not null,
  business_line text null,
  brand text null,
  category text null,
  subcategory text null,
  description text null,
  sale_price numeric(14,2) not null,
  current_cost numeric(14,2) null,
  minimum_stock integer not null default 0,
  status text not null default 'ACTIVE',
  visible_on_website boolean not null default false,
  main_image_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_sale_price_nonnegative check (sale_price >= 0),
  constraint products_current_cost_nonnegative check (current_cost is null or current_cost >= 0),
  constraint products_minimum_stock_nonnegative check (minimum_stock >= 0),
  constraint products_status_check check (status in ('ACTIVE','INACTIVE','DISCONTINUED','ARCHIVED'))
);

create unique index products_sku_unique_not_null on public.products (sku) where sku is not null;
create unique index products_catalog_code_unique_not_null on public.products (catalog_code) where catalog_code is not null;
create index products_name_idx on public.products (name);
create index products_status_idx on public.products (status);

alter table public.products enable row level security;
revoke all on table public.products from anon;
revoke insert, update, delete, truncate, references, trigger on table public.products from authenticated;
grant select on table public.products to authenticated;

create policy products_authenticated_read on public.products for select to authenticated using (true);

comment on table public.products is 'LIHEN Platform DEV Product Core master. FASE 1.2.2 foundation; writes remain blocked.';
comment on column public.products.brand is 'Legacy compatibility text. Future canonical relation: brand_id.';
comment on column public.products.category is 'Legacy compatibility text. Future canonical relation: category_id.';
comment on column public.products.subcategory is 'Legacy compatibility text. Future canonical category hierarchy.';
comment on column public.products.main_image_url is 'Legacy compatibility field. product_images will become authoritative.';
