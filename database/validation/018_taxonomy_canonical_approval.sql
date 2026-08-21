-- FASE 1.20.1 validation
select
  (select count(*) from lihen_private.taxonomy_source_records where source_key='CATALOG_V1_TAXONOMY_APPROVAL_2026_08_21') as source_records,
  (select count(*) from lihen_private.taxonomy_reconciliation_decisions where run_id='320706a7-e345-5936-892a-d01727ad0afb'::uuid and decision='APPROVE_NEW_ENTITY') as approvals,
  (select count(*) from public.brands) as brands_rows,
  (select count(*) from public.categories) as categories_rows,
  (select count(*) from public.products) as products_rows;
