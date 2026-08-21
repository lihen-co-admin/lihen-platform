-- FASE 1.8.1 — PENDING / NO EJECUTAR EN PROD
-- Añade referencias canónicas nullable. No cambia consumidores ni elimina textos legacy.
-- PRECONDICIÓN: brands/categories creadas y validadas en DEV.

begin;

alter table public.products
  add column if not exists brand_id uuid null;

alter table public.products
  add column if not exists category_id uuid null;

-- FKs se agregan NOT VALID para minimizar riesgo de datos legacy existentes.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_brand_id_fkey'
  ) then
    alter table public.products
      add constraint products_brand_id_fkey
      foreign key (brand_id) references public.brands(id)
      on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_category_id_fkey'
  ) then
    alter table public.products
      add constraint products_category_id_fkey
      foreign key (category_id) references public.categories(id)
      on delete restrict not valid;
  end if;
end $$;

create index if not exists idx_products_brand_id on public.products(brand_id);
create index if not exists idx_products_category_id on public.products(category_id);

commit;
