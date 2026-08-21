-- FASE 1.21 validation: staging exists, canonical products remain untouched.
select
  (select count(*) from public.products) as products_rows,
  (select count(*) from public.brands) as brands_rows,
  (select count(*) from public.categories) as categories_rows,
  (select count(*) from lihen_private.product_import_candidate_runs) as candidate_runs_rows,
  (select count(*) from lihen_private.product_import_candidates) as candidate_rows,
  (select count(*) from lihen_private.product_import_candidate_reviews) as candidate_reviews_rows;
