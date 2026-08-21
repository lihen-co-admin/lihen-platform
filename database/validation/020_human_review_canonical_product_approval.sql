-- FASE 1.21.4 final gates
select resolution,count(*) from lihen_private.product_candidate_identity_resolutions where run_id='d4d17a39-008d-4bcc-88b2-384cc147e262'::uuid group by resolution order by resolution;
select decision,count(*) from lihen_private.product_import_candidate_reviews where run_id='d4d17a39-008d-4bcc-88b2-384cc147e262'::uuid group by decision order by decision;
select count(*) as products_rows from public.products;
select has_function_privilege('authenticated','public.record_product_candidate_decision_controlled(text,uuid,text,text,uuid,text)','EXECUTE') as candidate_review_execute, has_function_privilege('authenticated','public.record_product_identity_resolution_controlled(text,uuid,text,text,text,text)','EXECUTE') as identity_review_execute;
