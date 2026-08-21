-- FASE 1.15 validation / dry-run. READ ONLY.
select * from lihen_private.product_image_legacy_backfill_summary();

select *
from lihen_private.preview_product_image_legacy_backfill()
where classification <> 'SKIP_NO_LEGACY_URL'
order by classification, catalog_code nulls last, sku nulls last, product_id;

-- Gate: this must be zero before the automatic backfill script is ever approved.
select count(*) as blocking_candidates
from lihen_private.preview_product_image_legacy_backfill()
where classification in (
  'CONFLICT_SHARED_LEGACY_URL',
  'CONFLICT_ACTIVE_MAIN',
  'CONFLICT_MATCHING_IMAGE_STATE',
  'REVIEW_EXISTING_IMAGES'
);
