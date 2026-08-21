-- FASE 1.20 validation: structure only, no data writes.
select
  (select count(*) from public.brands) as brands_rows,
  (select count(*) from public.categories) as categories_rows,
  (select count(*) from public.products) as products_rows,
  (select count(*) from lihen_private.taxonomy_source_snapshots) as source_snapshots_rows,
  (select count(*) from lihen_private.taxonomy_source_records) as source_records_rows,
  (select count(*) from lihen_private.taxonomy_reconciliation_runs) as reconciliation_runs_rows,
  (select count(*) from lihen_private.taxonomy_reconciliation_results) as reconciliation_results_rows,
  (select count(*) from lihen_private.taxonomy_reconciliation_decisions) as reconciliation_decisions_rows;
