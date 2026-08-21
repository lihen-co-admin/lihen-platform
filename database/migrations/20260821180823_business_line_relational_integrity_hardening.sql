-- FASE 1.21.2.1 — relational integrity for canonical business lines.
create unique index if not exists categories_id_business_line_uidx on public.categories(id,business_line);

alter table public.products drop constraint if exists products_category_business_line_fkey;
alter table public.products
  add constraint products_category_business_line_fkey
  foreign key(category_id,business_line)
  references public.categories(id,business_line)
  on delete restrict;

alter table lihen_private.product_import_candidates drop constraint if exists product_import_candidates_category_business_line_fkey;
alter table lihen_private.product_import_candidates
  add constraint product_import_candidates_category_business_line_fkey
  foreign key(category_id,business_line)
  references public.categories(id,business_line)
  on delete restrict;

alter table public.categories drop constraint if exists categories_parent_business_line_fkey;
alter table public.categories
  add constraint categories_parent_business_line_fkey
  foreign key(parent_id,business_line)
  references public.categories(id,business_line)
  on delete restrict;
