create or replace function public.get_phase3_cutover_gate_controlled(p_run_id uuid)
returns table(
  run_id uuid,
  phase3_run_status text,
  batch_id uuid,
  phase3_batch_status text,
  phase3_verification_status text,
  failed_post_checks bigint,
  phase4_readiness text,
  readiness_reason text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_PHASE3_GATE_READ_FORBIDDEN';
  end if;

  return query
  select
    r.id,
    r.status,
    b.id,
    b.status,
    coalesce(v.verification_status, 'WAITING_FOR_VERIFICATION'::text),
    coalesce(v.failed_checks, 0::bigint),
    case
      when r.status <> 'APPLIED' then 'BLOCKED'::text
      when b.status <> 'APPLIED' then 'BLOCKED'::text
      when coalesce(v.verification_status, 'WAITING_FOR_VERIFICATION'::text) <> 'PASS' then 'BLOCKED'::text
      when coalesce(v.failed_checks, 0::bigint) > 0 then 'BLOCKED'::text
      else 'READY'::text
    end,
    case
      when r.status <> 'APPLIED' then 'PHASE3_CUTOVER_NOT_APPLIED'::text
      when b.status <> 'APPLIED' then 'PHASE3_BATCH_NOT_APPLIED'::text
      when coalesce(v.verification_status, 'WAITING_FOR_VERIFICATION'::text) <> 'PASS' then 'PHASE3_POST_VERIFICATION_NOT_PASSED'::text
      when coalesce(v.failed_checks, 0::bigint) > 0 then 'PHASE3_POST_VERIFICATION_FAILED'::text
      else 'PHASE3_EXIT_GATE_PASSED'::text
    end
  from lihen_private.cutover_runs r
  left join lihen_private.cutover_execution_batches b on b.run_id = r.id
  left join public.cutover_post_verification_summary v on v.run_id = r.id
  where r.id = p_run_id;

  if not found then
    raise exception using errcode='P0002', message='LIHEN_CUTOVER_RUN_NOT_FOUND';
  end if;
end;
$function$;

revoke all on function public.get_phase3_cutover_gate_controlled(uuid) from public, anon;
grant execute on function public.get_phase3_cutover_gate_controlled(uuid) to authenticated;

comment on function public.get_phase3_cutover_gate_controlled(uuid) is
  'Controlled FASE 3/4 gate status projection for ACTIVE OWNER/ADMIN. Keeps lihen_private deny-by-default intact.';
