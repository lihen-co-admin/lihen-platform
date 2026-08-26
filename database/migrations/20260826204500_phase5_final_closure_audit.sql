create or replace view lihen_private.phase5_final_closure_audit as
with visual as (
  select count(*)::int total_cases,
         count(*) filter(where regression_pass)::int pass_cases,
         count(*) filter(where not regression_pass)::int failed_cases
  from lihen_private.visual_intelligence_regression_case_status
), eugym_doc as (
  select id,candidate_run_id from lihen_private.supplier_source_documents
  where source_name='CATÁLOGO EUGYM SPORT.pdf' order by created_at desc limit 1
), eugym as (
  select d.id document_id,d.candidate_run_id,
    count(b.*)::int bridge_results,
    count(*) filter(where b.disposition='EXISTING_MATCH')::int existing_matches,
    count(*) filter(where b.disposition='READY_CANDIDATE')::int ready_candidates,
    count(*) filter(where b.disposition='REVIEW_REQUIRED')::int review_required,
    count(*) filter(where b.disposition='REJECTED')::int rejected,
    (select count(*)::int from lihen_private.product_import_candidate_reviews r where r.run_id=d.candidate_run_id) review_decisions,
    (select count(*)::int from lihen_private.product_import_candidate_reviews r where r.run_id=d.candidate_run_id and r.decision='LINK_EXISTING_PRODUCT') link_existing_decisions
  from eugym_doc d left join lihen_private.supplier_candidate_bridge_results b on b.candidate_run_id=d.candidate_run_id
  group by d.id,d.candidate_run_id
), style as (
  select count(*)::int total_products,count(*) filter(where visible_on_website)::int visible_products
  from public.products where business_line='STYLE' and status='ACTIVE'
), qac as (select * from lihen_private.phase5_qac_product_detail_media_closure_status limit 1)
select
 case when
   exists(select 1 from lihen_private.phase_exit_gate_results g where g.phase_code='5' and g.status='PASS')
   and exists(select 1 from lihen_private.phase_exit_gate_results g where g.phase_code='5.2' and g.status='PASS')
   and q.technical_status='PASS'
   and v.total_cases>0 and v.failed_cases=0
   and to_regclass('lihen_private.public_hub_blocks') is not null
   and exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_public_hub_controlled')
   and exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_public_hub_blocks_admin_controlled')
   and exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_storefront_products_qa_a_controlled')
   and exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_storefront_products_qa_b_controlled')
   and e.candidate_run_id is not null and e.bridge_results=23 and e.existing_matches=23
   and e.ready_candidates=0 and e.review_required=0 and e.rejected=0
   and e.review_decisions=23 and e.link_existing_decisions=23
   and s.visible_products=0
 then 'PASS' else 'BLOCKED' end closure_status,
 q.media_content_debt_status,
 q.visible_active_products,q.no_media_products,q.web_detail_products,q.gallery_ready_products,
 v.total_cases visual_regression_total,v.pass_cases visual_regression_pass,v.failed_cases visual_regression_failed,
 e.document_id eugym_document_id,e.candidate_run_id eugym_candidate_run_id,e.bridge_results eugym_bridge_results,
 e.existing_matches eugym_existing_matches,e.ready_candidates eugym_ready_candidates,e.review_required eugym_review_required,
 e.rejected eugym_rejected,e.review_decisions eugym_review_decisions,e.link_existing_decisions eugym_link_existing_decisions,
 s.total_products style_active_products,s.visible_products style_visible_products,
 jsonb_build_array('PHASE5_QAC_MEDIA_GALLERY_ENRICHMENT_PROGRESSIVE','PHASE5_QAC_WEB_DETAIL_ASSETS_PROGRESSIVE','PHASE5_QAC_APPROVED_ENRICHMENT_PROGRESSIVE','STYLE_PUBLICATION_REMAINS_EXPLICITLY_DEFERRED') non_blocking_debt
from qac q cross join visual v cross join eugym e cross join style s;

revoke all on lihen_private.phase5_final_closure_audit from public,anon,authenticated;
grant select on lihen_private.phase5_final_closure_audit to postgres;

create or replace function public.get_phase5_final_closure_audit_controlled()
returns setof lihen_private.phase5_final_closure_audit
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then
   raise exception using errcode='42501',message='LIHEN_PHASE5_FINAL_AUDIT_FORBIDDEN';
 end if;
 return query select * from lihen_private.phase5_final_closure_audit;
end;$$;

revoke all on function public.get_phase5_final_closure_audit_controlled() from public,anon;
grant execute on function public.get_phase5_final_closure_audit_controlled() to authenticated,postgres;
