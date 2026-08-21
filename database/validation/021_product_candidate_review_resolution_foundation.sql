-- Expected DEV state after FASE 1.21.2 foundation.
select
  (select count(*) from lihen_private.product_candidate_identity_groups
   where run_id='d4d17a39-008d-4bcc-88b2-384cc147e262' and member_count>1) as multi_member_identity_groups,
  (select coalesce(sum(member_count),0) from lihen_private.product_candidate_identity_groups
   where run_id='d4d17a39-008d-4bcc-88b2-384cc147e262' and member_count>1) as multi_member_candidates,
  (select count(*) from lihen_private.product_candidate_identity_groups
   where run_id='d4d17a39-008d-4bcc-88b2-384cc147e262' and member_count=1) as singleton_residual_conflicts,
  (select count(*) from lihen_private.product_import_candidates
   where run_id='d4d17a39-008d-4bcc-88b2-384cc147e262' and status='REVIEW_REQUIRED') as review_required,
  (select count(*) from lihen_private.product_import_candidate_reviews) as candidate_decisions,
  (select count(*) from lihen_private.product_candidate_identity_resolutions) as identity_resolutions,
  (select count(*) from public.products) as products_rows;
