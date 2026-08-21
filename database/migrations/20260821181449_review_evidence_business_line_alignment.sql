-- FASE 1.21.3 follow-up after FASE 1.21.2.1 business-line hardening.
-- Aligns evidence proposals with the canonical business-line boundary.
alter table lihen_private.product_import_candidate_runs
  add constraint product_import_candidate_runs_id_business_line_uk unique (id,business_line);

alter table lihen_private.product_review_evidence_runs add column business_line text;
update lihen_private.product_review_evidence_runs r
set business_line = cr.business_line
from lihen_private.product_import_candidate_runs cr
where cr.id=r.candidate_run_id;
alter table lihen_private.product_review_evidence_runs
  alter column business_line set not null,
  add constraint product_review_evidence_runs_business_line_fkey foreign key (business_line) references public.business_lines(code) on delete restrict,
  add constraint product_review_evidence_runs_candidate_line_fkey foreign key (candidate_run_id,business_line) references lihen_private.product_import_candidate_runs(id,business_line) on delete restrict,
  add constraint product_review_evidence_runs_id_business_line_uk unique (id,business_line);

alter table lihen_private.product_identity_evidence_proposals add column business_line text;
update lihen_private.product_identity_evidence_proposals p
set business_line=r.business_line,
    identity_key=case when p.identity_key like r.business_line || '|%' then p.identity_key else r.business_line || '|' || p.identity_key end
from lihen_private.product_review_evidence_runs r
where r.id=p.evidence_run_id;
alter table lihen_private.product_identity_evidence_proposals
  alter column business_line set not null,
  add constraint product_identity_evidence_proposals_business_line_fkey foreign key (business_line) references public.business_lines(code) on delete restrict,
  add constraint product_identity_evidence_proposals_run_line_fkey foreign key (evidence_run_id,business_line) references lihen_private.product_review_evidence_runs(id,business_line) on delete restrict;

alter table lihen_private.product_candidate_evidence_proposals add column business_line text;
update lihen_private.product_candidate_evidence_proposals p
set business_line=r.business_line
from lihen_private.product_review_evidence_runs r
where r.id=p.evidence_run_id;
alter table lihen_private.product_candidate_evidence_proposals
  alter column business_line set not null,
  add constraint product_candidate_evidence_proposals_business_line_fkey foreign key (business_line) references public.business_lines(code) on delete restrict,
  add constraint product_candidate_evidence_proposals_run_line_fkey foreign key (evidence_run_id,business_line) references lihen_private.product_review_evidence_runs(id,business_line) on delete restrict,
  add constraint product_candidate_evidence_proposals_candidate_line_fkey foreign key (candidate_run_id,business_line) references lihen_private.product_import_candidate_runs(id,business_line) on delete restrict;

revoke all on lihen_private.product_review_evidence_runs from public, anon, authenticated;
revoke all on lihen_private.product_identity_evidence_proposals from public, anon, authenticated;
revoke all on lihen_private.product_candidate_evidence_proposals from public, anon, authenticated;
