drop view if exists lihen_private.product_candidate_review_resolution_queue;
drop view if exists lihen_private.product_candidate_identity_groups;
create view lihen_private.product_candidate_identity_groups as
select c.run_id, concat_ws('|', c.business_line, c.normalized_name, coalesce(c.brand_id::text,''), coalesce(c.category_id::text,'')) as identity_key, c.normalized_name, c.brand_id, c.category_id, count(*)::integer as member_count, array_agg(c.source_reference_id order by c.source_page,c.source_slot) as source_reference_ids, array_agg(c.product_name order by c.source_page,c.source_slot) as product_names, array_agg(c.sale_price order by c.source_page,c.source_slot) as sale_prices, array_agg(c.image_sha256 order by c.source_page,c.source_slot) as image_sha256s, c.business_line
from lihen_private.product_import_candidates c
where c.status in ('CONFLICT','REVIEW_REQUIRED')
group by c.run_id,c.business_line,c.normalized_name,c.brand_id,c.category_id
having count(*) > 1;
create view lihen_private.product_candidate_review_resolution_queue as
select q.run_id,q.source_reference_id,q.source_page,q.source_slot,q.product_name,q.normalized_name,q.business_line,q.brand_id,q.brand_name,q.category_id,q.category_name,q.sale_price,q.image_sha256,q.status,q.proposed_action,q.identity_group_size,q.reasons,q.supplier_evidence,q.review_priority,q.decision_count,concat_ws('|',q.business_line,q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,'')) as identity_key,g.member_count as conflict_group_size,lr.resolution as latest_identity_resolution,lr.canonical_source_reference_id,lr.decided_at as identity_resolved_at,ld.decision as latest_candidate_decision,ld.selected_product_id,ld.decided_at as candidate_decided_at
from lihen_private.product_import_candidate_review_queue q
left join lihen_private.product_candidate_identity_groups g on g.run_id=q.run_id and g.identity_key=concat_ws('|',q.business_line,q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,''))
left join lateral (select r.resolution,r.canonical_source_reference_id,r.decided_at from lihen_private.product_candidate_identity_resolutions r where r.run_id=q.run_id and r.identity_key=concat_ws('|',q.business_line,q.normalized_name,coalesce(q.brand_id::text,''),coalesce(q.category_id::text,'')) order by r.decided_at desc limit 1) lr on true
left join lateral (select d.decision,d.selected_product_id,d.decided_at from lihen_private.product_import_candidate_reviews d where d.run_id=q.run_id and d.source_reference_id=q.source_reference_id order by d.decided_at desc limit 1) ld on true;
revoke all on lihen_private.product_candidate_identity_groups from public,anon,authenticated;
revoke all on lihen_private.product_candidate_review_resolution_queue from public,anon,authenticated;
