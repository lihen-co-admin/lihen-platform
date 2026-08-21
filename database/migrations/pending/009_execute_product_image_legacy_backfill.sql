-- PENDING / DO NOT APPLY YET.
-- Future FASE 1.15 cutover. Non-destructive: does not change products.main_image_url.
-- Preconditions:
--   1) dry-run blocking_candidates = 0
--   2) explicit human approval
--   3) snapshot/export of products + product_images
--   4) DEV execution and before/after comparison

begin;

do $$
begin
  if exists (
    select 1
    from lihen_private.preview_product_image_legacy_backfill()
    where classification in (
      'CONFLICT_SHARED_LEGACY_URL',
      'CONFLICT_ACTIVE_MAIN',
      'CONFLICT_MATCHING_IMAGE_STATE',
      'REVIEW_EXISTING_IMAGES'
    )
  ) then
    raise exception 'LIHEN_PRODUCT_IMAGE_BACKFILL_BLOCKED_BY_CONFLICTS';
  end if;
end;
$$;

insert into public.product_images (
  id, product_id, public_url, storage_bucket, storage_path,
  alt_text, is_main, sort_order, source_type, status
)
select
  gen_random_uuid(),
  p.product_id,
  p.legacy_main_image_url,
  null,
  null,
  p.product_name,
  true,
  0,
  'LEGACY_MAIN_IMAGE_URL',
  'ACTIVE'
from lihen_private.preview_product_image_legacy_backfill() p
where p.classification = 'READY'
  and p.eligible_for_auto_backfill = true;

-- Keep products.main_image_url untouched for dual compatibility.
commit;
