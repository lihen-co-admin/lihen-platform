-- FASE 1.21.2.1 — business_line must be part of candidate identity scope.
create or replace view lihen_private.product_candidate_identity_groups as
select run_id,
       md5(concat_ws('|',business_line,normalized_name,coalesce(brand_id::text,''),coalesce(category_id::text,''))) as identity_key,
       normalized_name,brand_id,category_id,count(*)::integer as member_count,
       array_agg(source_reference_id order by source_page,source_slot) as source_reference_ids,
       array_agg(product_name order by source_page,source_slot) as product_names,
       array_agg(sale_price order by source_page,source_slot) as sale_prices,
       array_agg(image_sha256 order by source_page,source_slot) as image_sha256s,
       business_line
from lihen_private.product_import_candidates c
where status='CONFLICT'
group by run_id,business_line,normalized_name,brand_id,category_id;
revoke all on lihen_private.product_candidate_identity_groups from public,anon,authenticated;

create or replace view lihen_private.product_candidate_review_resolution_queue as
select q.run_id,q.source_reference_id,q.source_page,q.source_slot,q.product_name,q.normalized_name,q.business_line,
       q.brand_id,q.brand_name,q.category_id,q.category_name,q.sale_price,q.image_sha256,q.status,q.proposed_action,
       q.identity_group_size,q.reasons,q.supplier_evidence,q.review_priority,q.decision_count,
       md5(concat_ws('|',q.business_line,q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,''))) as identity_key,
       g.member_count as conflict_group_size,
       lr.resolution as latest_identity_resolution,lr.canonical_source_reference_id,lr.decided_at as identity_resolved_at,
       ld.decision as latest_candidate_decision,ld.selected_product_id,ld.decided_at as candidate_decided_at
from lihen_private.product_import_candidate_review_queue q
left join lihen_private.product_candidate_identity_groups g
  on g.run_id=q.run_id and g.identity_key=md5(concat_ws('|',q.business_line,q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,'')))
left join lateral (
  select r.resolution,r.canonical_source_reference_id,r.decided_at
  from lihen_private.product_candidate_identity_resolutions r
  where r.run_id=q.run_id and r.identity_key=md5(concat_ws('|',q.business_line,q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,'')))
  order by r.decided_at desc limit 1
) lr on true
left join lateral (
  select d.decision,d.selected_product_id,d.decided_at
  from lihen_private.product_import_candidate_reviews d
  where d.run_id=q.run_id and d.source_reference_id=q.source_reference_id
  order by d.decided_at desc limit 1
) ld on true;
revoke all on lihen_private.product_candidate_review_resolution_queue from public,anon,authenticated;
