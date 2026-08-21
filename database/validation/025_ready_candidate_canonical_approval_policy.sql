-- FASE 1.21.5.1 validation
select eligibility_status,count(*)
from lihen_private.preview_ready_candidate_policy(
  'd4d17a39-008d-4bcc-88b2-384cc147e262'::uuid,
  'READY_CANDIDATE_CANONICAL_APPROVAL_V1'
)
group by eligibility_status;

select approval_source,count(*)
from lihen_private.canonical_product_approvals
where candidate_run_id='d4d17a39-008d-4bcc-88b2-384cc147e262'::uuid
group by approval_source;

select
  (select count(*) from lihen_private.ready_candidate_policy_approvals where candidate_run_id='d4d17a39-008d-4bcc-88b2-384cc147e262'::uuid) policy_approvals,
  (select count(*) from lihen_private.canonical_product_approvals where candidate_run_id='d4d17a39-008d-4bcc-88b2-384cc147e262'::uuid) canonical_approved_total,
  (select count(*) from public.products) products_rows,
  has_function_privilege('authenticated','public.apply_ready_candidate_approval_policy_controlled(text,uuid,text)','EXECUTE') authenticated_execute;
