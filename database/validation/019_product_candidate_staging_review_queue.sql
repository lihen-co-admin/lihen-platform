-- FASE 1.21.1 final DEV gates
select
  count(*) as candidate_rows,
  count(*) filter (where status='READY_CANDIDATE') as ready_candidate,
  count(*) filter (where status='CONFLICT') as conflicts,
  count(*) filter (where status='REVIEW_REQUIRED') as review_required,
  count(*) filter (where image_sha256 is null) as missing_image_sha256,
  count(*) filter (where image_sha256 ~ '^[0-9a-f]{64}$') as valid_image_sha256,
  count(*) filter (where auto_insert_allowed) as auto_insert_true
from lihen_private.product_import_candidates
where run_id='d4d17a39-008d-4bcc-88b2-384cc147e262'::uuid;

select
  count(*) as queue_rows,
  count(*) filter (where status='CONFLICT') as conflict_queue,
  count(*) filter (where status='REVIEW_REQUIRED') as review_queue
from lihen_private.product_import_candidate_review_queue
where run_id='d4d17a39-008d-4bcc-88b2-384cc147e262'::uuid;

select
  (select count(*) from public.products) as products_rows,
  (select count(*) from public.product_images) as product_images_rows,
  (select count(*) from storage.objects) as storage_objects_rows,
  (select count(*) from lihen_private.product_import_candidate_reviews
    where run_id='d4d17a39-008d-4bcc-88b2-384cc147e262'::uuid) as review_decisions;
