-- FASE 1.19 validation: structure only; no data import expected.
select
  (select count(*) from public.products) as products_rows,
  (select count(*) from public.brands) as brands_rows,
  (select count(*) from public.categories) as categories_rows,
  (select count(*) from lihen_private.product_master_source_snapshots) as source_snapshots_rows,
  (select count(*) from lihen_private.product_master_source_records) as source_records_rows,
  (select count(*) from lihen_private.product_master_reconciliation_runs) as reconciliation_runs_rows,
  (select count(*) from lihen_private.product_master_reconciliation_results) as reconciliation_results_rows,
  (select count(*) from lihen_private.product_master_reconciliation_decisions) as reconciliation_decisions_rows;

select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='lihen_private'
  and table_name in (
    'product_master_source_snapshots','product_master_source_records',
    'product_master_reconciliation_runs','product_master_reconciliation_results',
    'product_master_reconciliation_decisions'
  )
  and grantee in ('anon','authenticated','PUBLIC')
order by table_name, grantee, privilege_type;
