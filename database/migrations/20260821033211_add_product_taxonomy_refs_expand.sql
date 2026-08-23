alter table public.products add column brand_id uuid null;
alter table public.products add column category_id uuid null;

alter table public.products
  add constraint products_brand_id_fkey
  foreign key (brand_id) references public.brands(id)
  on delete restrict not valid;

alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id) references public.categories(id)
  on delete restrict not valid;

create index products_brand_id_idx on public.products(brand_id);
create index products_category_id_idx on public.products(category_id);

comment on column public.products.brand_id is 'Canonical brand reference. Nullable during expand/backfill.';
comment on column public.products.category_id is 'Canonical category reference. Nullable during expand/backfill.';
