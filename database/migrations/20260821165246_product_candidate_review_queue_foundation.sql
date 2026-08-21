-- FASE 1.21.1 — PRODUCT CANDIDATE STAGING & REVIEW QUEUE
-- Read-only private operational queue. No public.products writes.

create or replace view lihen_private.product_import_candidate_review_queue as
select
  c.run_id,
  c.source_reference_id,
  c.source_page,
  c.source_slot,
  c.product_name,
  c.normalized_name,
  c.brand_id,
  b.name as brand_name,
  c.category_id,
  cat.name as category_name,
  c.sale_price,
  c.image_sha256,
  c.status,
  c.proposed_action,
  c.identity_group_size,
  c.reasons,
  c.supplier_evidence,
  case c.status
    when 'CONFLICT' then 1
    when 'REVIEW_REQUIRED' then 2
    else 99
  end as review_priority,
  (
    select count(*)
    from lihen_private.product_import_candidate_reviews r
    where r.run_id = c.run_id
      and r.source_reference_id = c.source_reference_id
  ) as decision_count
from lihen_private.product_import_candidates c
left join public.brands b on b.id = c.brand_id
left join public.categories cat on cat.id = c.category_id
where c.status in ('CONFLICT','REVIEW_REQUIRED');

revoke all on lihen_private.product_import_candidate_review_queue from public, anon, authenticated;
