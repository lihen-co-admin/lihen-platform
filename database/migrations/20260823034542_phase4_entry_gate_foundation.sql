create or replace view public.phase4_entry_readiness
with (security_invoker=true)
as
select
  r.id as run_id,
  r.status as phase3_run_status,
  b.id as batch_id,
  b.status as phase3_batch_status,
  coalesce(v.verification_status,'WAITING_FOR_VERIFICATION') as phase3_verification_status,
  coalesce(v.failed_checks,0) as failed_post_checks,
  case
    when r.status<>'APPLIED' then 'BLOCKED'
    when b.status<>'APPLIED' then 'BLOCKED'
    when coalesce(v.verification_status,'WAITING_FOR_VERIFICATION')<>'PASS' then 'BLOCKED'
    when coalesce(v.failed_checks,0)>0 then 'BLOCKED'
    else 'READY'
  end as phase4_readiness,
  case
    when r.status<>'APPLIED' then 'PHASE3_CUTOVER_NOT_APPLIED'
    when b.status<>'APPLIED' then 'PHASE3_BATCH_NOT_APPLIED'
    when coalesce(v.verification_status,'WAITING_FOR_VERIFICATION')<>'PASS' then 'PHASE3_POST_VERIFICATION_NOT_PASSED'
    when coalesce(v.failed_checks,0)>0 then 'PHASE3_POST_VERIFICATION_FAILED'
    else 'PHASE3_EXIT_GATE_PASSED'
  end as readiness_reason
from lihen_private.cutover_runs r
left join lihen_private.cutover_execution_batches b on b.run_id=r.id
left join public.cutover_post_verification_summary v on v.run_id=r.id;

revoke all on public.phase4_entry_readiness from anon;
grant select on public.phase4_entry_readiness to authenticated;
