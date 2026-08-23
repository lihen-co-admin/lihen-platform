-- FASE 3 — Gate efectivo: un estado legacy ya resuelto por plan READY/SKIPPED/APPLIED no bloquea.
-- Conserva exactamente la firma de columnas de public.cutover_domain_readiness.

create or replace view public.cutover_domain_readiness
with (security_invoker = true)
as
with domains(domain) as (
  values ('PRODUCT'),('INVENTORY'),('SUPPLIER'),('PURCHASE'),('ORDER'),('SALE'),('FINANCE')
),
resolved_items as (
  select i.*,
    p.plan_status,
    (p.plan_status in ('READY','SKIPPED','APPLIED')) as plan_resolved
  from lihen_private.cutover_items i
  left join lihen_private.cutover_application_plan p
    on p.run_id=i.run_id and p.domain=i.domain and p.source_row_key=i.source_row_key
),
item_counts as (
  select run_id,domain,
    count(*) total_items,
    count(*) filter (where match_status='MATCHED' or plan_resolved) matched_items,
    count(*) filter (where match_status='AMBIGUOUS' and not coalesce(plan_resolved,false)) ambiguous_items,
    count(*) filter (where match_status='UNMATCHED' and not coalesce(plan_resolved,false)) unmatched_items,
    count(*) filter (where match_status='BLOCKED' and not coalesce(plan_resolved,false)) blocked_items,
    count(*) filter (where decision_status in ('POLICY_APPROVED','HUMAN_APPROVED') or plan_resolved) approved_items,
    count(*) filter (where decision_status='PENDING' and not coalesce(plan_resolved,false)) pending_items,
    count(*) filter (where decision_status='REJECTED' and not coalesce(plan_resolved,false)) rejected_items
  from resolved_items group by run_id,domain
),
plan_counts as (
  select run_id,domain,count(*) total_plan_rows,
    count(*) filter (where plan_status in ('READY','SKIPPED','APPLIED')) ready_plan_rows,
    count(*) filter (where plan_status='BLOCKED') blocked_plan_rows
  from lihen_private.cutover_application_plan group by run_id,domain
),
validation_counts as (
  select run_id,domain,count(*) filter(where status='FAIL') failed_checks,count(*) filter(where status='WARN') warning_checks
  from lihen_private.cutover_validations where domain<>'GLOBAL' group by run_id,domain
)
select r.id as run_id,d.domain,
  coalesce(i.total_items,0) total_items,coalesce(i.matched_items,0) matched_items,
  coalesce(i.ambiguous_items,0) ambiguous_items,coalesce(i.unmatched_items,0) unmatched_items,
  coalesce(i.blocked_items,0) blocked_items,coalesce(i.approved_items,0) approved_items,
  coalesce(i.pending_items,0) pending_items,coalesce(i.rejected_items,0) rejected_items,
  coalesce(p.total_plan_rows,0) total_plan_rows,coalesce(p.ready_plan_rows,0) ready_plan_rows,
  coalesce(p.blocked_plan_rows,0) blocked_plan_rows,coalesce(v.failed_checks,0) failed_checks,
  coalesce(v.warning_checks,0) warning_checks,
  case
    when coalesce(i.ambiguous_items,0)>0 or coalesce(i.unmatched_items,0)>0 or coalesce(i.blocked_items,0)>0
      or coalesce(i.pending_items,0)>0 or coalesce(i.rejected_items,0)>0 or coalesce(p.blocked_plan_rows,0)>0
      or coalesce(v.failed_checks,0)>0 then 'BLOCKED'
    when coalesce(i.total_items,0)=0 then 'EMPTY'
    when coalesce(i.approved_items,0)=coalesce(i.total_items,0)
      and coalesce(p.ready_plan_rows,0)=coalesce(p.total_plan_rows,0) then 'READY'
    else 'REVIEW'
  end as readiness
from lihen_private.cutover_runs r cross join domains d
left join item_counts i on i.run_id=r.id and i.domain=d.domain
left join plan_counts p on p.run_id=r.id and p.domain=d.domain
left join validation_counts v on v.run_id=r.id and v.domain=d.domain;
