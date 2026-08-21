-- FASE 1.21.3 acceptance gates
select
  (select count(*) from lihen_private.product_identity_evidence_proposals) = 37 as identity_proposals_37,
  (select count(*) from lihen_private.product_candidate_evidence_proposals) = 187 as candidate_proposals_187,
  (select count(*) from lihen_private.product_identity_evidence_proposals where business_line='BEAUTY_CARE') = 37 as identity_beauty_37,
  (select count(*) from lihen_private.product_candidate_evidence_proposals where business_line='BEAUTY_CARE') = 187 as candidate_beauty_187,
  (select count(*) from lihen_private.product_identity_evidence_proposals where identity_key like 'BEAUTY_CARE|%') = 37 as identity_scoped_37,
  (select count(*) from lihen_private.product_import_candidate_reviews) = 0 as no_human_candidate_decisions,
  (select count(*) from lihen_private.product_candidate_identity_resolutions) = 0 as no_human_identity_resolutions,
  (select count(*) from public.products) = 0 as no_products_created;
