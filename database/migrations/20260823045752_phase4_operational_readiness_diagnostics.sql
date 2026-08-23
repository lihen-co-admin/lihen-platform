create or replace view public.phase4_operational_diagnostics
with (security_invoker = true)
as
with metrics as (
  select
    (select count(*) from public.products where status='ACTIVE')::bigint as active_products,
    (select count(*) from public.products where status='ACTIVE' and current_cost is null)::bigint as active_products_without_cost,
    (select count(*) from public.products where status='ACTIVE' and sale_price < 0)::bigint as active_products_invalid_sale_price,
    (select count(*) from public.products where status='ACTIVE' and visible_on_website=true and coalesce(main_image_url,'')='')::bigint as visible_products_without_main_image,
    (select count(*) from public.inventory_stock where stock_on_hand<0 or stock_reserved<0 or stock_pending<0 or stock_available<0)::bigint as invalid_inventory_rows,
    (select count(*) from public.inventory_stock s left join public.products p on p.id=s.product_id where p.id is null)::bigint as orphan_inventory_rows,
    (select count(*) from (select sku from public.products where sku is not null group by sku having count(*)>1) d)::bigint as duplicate_skus,
    (select count(*) from (select catalog_code from public.products where catalog_code is not null group by catalog_code having count(*)>1) d)::bigint as duplicate_catalog_codes,
    (select count(*) from (select slug from public.products group by slug having count(*)>1) d)::bigint as duplicate_slugs
)
select 'PRODUCT_COST_COMPLETENESS'::text as check_code,
       case when active_products_without_cost=0 then 'PASS' else 'WARN' end::text as status,
       active_products_without_cost::integer as issue_count,
       jsonb_build_object('active_products',active_products,'without_cost',active_products_without_cost,'meaning','Legacy/canonical master cost completeness requires a dedicated Phase 4 data-quality decision; do not infer costs.') as details
from metrics
union all
select 'ACTIVE_PRODUCT_PRICE_VALIDITY',case when active_products_invalid_sale_price=0 then 'PASS' else 'FAIL' end,active_products_invalid_sale_price::integer,
       jsonb_build_object('invalid_negative_sale_prices',active_products_invalid_sale_price)
from metrics
union all
select 'PUBLIC_IMAGE_COVERAGE',case when visible_products_without_main_image=0 then 'PASS' else 'WARN' end,visible_products_without_main_image::integer,
       jsonb_build_object('visible_without_main_image',visible_products_without_main_image)
from metrics
union all
select 'INVENTORY_NONNEGATIVE',case when invalid_inventory_rows=0 then 'PASS' else 'FAIL' end,invalid_inventory_rows::integer,
       jsonb_build_object('invalid_inventory_rows',invalid_inventory_rows)
from metrics
union all
select 'INVENTORY_PRODUCT_REFERENTIAL_INTEGRITY',case when orphan_inventory_rows=0 then 'PASS' else 'FAIL' end,orphan_inventory_rows::integer,
       jsonb_build_object('orphan_inventory_rows',orphan_inventory_rows)
from metrics
union all
select 'PRODUCT_SKU_UNIQUENESS',case when duplicate_skus=0 then 'PASS' else 'FAIL' end,duplicate_skus::integer,
       jsonb_build_object('duplicate_sku_groups',duplicate_skus)
from metrics
union all
select 'PRODUCT_CATALOG_CODE_UNIQUENESS',case when duplicate_catalog_codes=0 then 'PASS' else 'FAIL' end,duplicate_catalog_codes::integer,
       jsonb_build_object('duplicate_catalog_code_groups',duplicate_catalog_codes)
from metrics
union all
select 'PRODUCT_SLUG_UNIQUENESS',case when duplicate_slugs=0 then 'PASS' else 'FAIL' end,duplicate_slugs::integer,
       jsonb_build_object('duplicate_slug_groups',duplicate_slugs)
from metrics;

create or replace view public.phase4_readiness_summary
with (security_invoker = true)
as
with d as (
  select
    count(*)::bigint as checks,
    count(*) filter(where status='PASS')::bigint as passed_checks,
    count(*) filter(where status='WARN')::bigint as warning_checks,
    count(*) filter(where status='FAIL')::bigint as failed_checks
  from public.phase4_operational_diagnostics
)
select e.run_id,e.phase3_run_status,e.batch_id,e.phase3_batch_status,e.phase3_verification_status,e.failed_post_checks,
       e.phase4_readiness as phase4_entry_readiness,e.readiness_reason as phase4_entry_reason,
       d.checks,d.passed_checks,d.warning_checks,d.failed_checks,
       case
         when e.phase4_readiness<>'READY' then 'BLOCKED'
         when d.failed_checks>0 then 'BLOCKED'
         when d.warning_checks>0 then 'READY_WITH_WARNINGS'
         else 'READY'
       end::text as phase4_operational_readiness
from public.phase4_entry_readiness e cross join d;
