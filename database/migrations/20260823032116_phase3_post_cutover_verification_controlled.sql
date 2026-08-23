create or replace function public.verify_phase3_cutover_controlled(p_run_id uuid)
returns table(check_code text,status text,issue_count integer,details jsonb)
language plpgsql security definer set search_path to '' as $function$
declare
  v_actor uuid:=auth.uid();
  v_batch lihen_private.cutover_execution_batches%rowtype;
  v_expected bigint;
  v_actual bigint;
  v_issues integer;
  v_expected_numeric numeric;
  v_actual_numeric numeric;
  v_checks jsonb:=jsonb_build_array();
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then
    raise exception using errcode='42501',message='LIHEN_CUTOVER_VERIFY_FORBIDDEN';
  end if;
  select * into v_batch from lihen_private.cutover_execution_batches b where b.run_id=p_run_id;
  if not found then raise exception using errcode='P0002',message='LIHEN_CUTOVER_BATCH_NOT_FOUND'; end if;
  if not exists(select 1 from lihen_private.cutover_runs r where r.id=p_run_id and r.status='APPLIED') or v_batch.status<>'APPLIED' then
    raise exception using errcode='22023',message='LIHEN_CUTOVER_NOT_APPLIED';
  end if;

  delete from lihen_private.cutover_post_verifications v where v.batch_id=v_batch.id;

  select count(*) into v_expected from lihen_private.cutover_application_plan p where p.run_id=p_run_id;
  select count(*) into v_actual from lihen_private.cutover_execution_receipts r where r.batch_id=v_batch.id;
  insert into lihen_private.cutover_post_verifications(batch_id,run_id,check_code,status,issue_count,details)
  values(v_batch.id,p_run_id,'RECEIPT_COVERAGE',case when v_actual=v_expected then 'PASS' else 'FAIL' end,abs((v_expected-v_actual)::integer),jsonb_build_object('expected',v_expected,'actual',v_actual));

  select count(*)::integer into v_issues from lihen_private.cutover_execution_receipts r where r.batch_id=v_batch.id and r.status='FAILED';
  insert into lihen_private.cutover_post_verifications(batch_id,run_id,check_code,status,issue_count,details)
  values(v_batch.id,p_run_id,'RECEIPT_FAILURES',case when v_issues=0 then 'PASS' else 'FAIL' end,v_issues,jsonb_build_object('failed_receipts',v_issues));

  select count(*)::integer into v_issues from public.inventory_stock s where s.stock_on_hand<0 or s.stock_reserved<0 or s.stock_pending<0 or s.stock_available<0;
  insert into lihen_private.cutover_post_verifications(batch_id,run_id,check_code,status,issue_count,details)
  values(v_batch.id,p_run_id,'INVENTORY_NONNEGATIVE',case when v_issues=0 then 'PASS' else 'FAIL' end,v_issues,jsonb_build_object('invalid_rows',v_issues));

  select count(*)::integer into v_issues
  from lihen_private.cutover_application_plan p
  left join public.inventory_stock s on s.product_id=p.canonical_entity_id
  where p.run_id=p_run_id and p.domain='INVENTORY' and p.plan_status='READY' and p.canonical_entity_id is not null
    and coalesce(s.stock_on_hand,0)<>coalesce((p.proposed_state->>'on_hand')::bigint,0);
  insert into lihen_private.cutover_post_verifications(batch_id,run_id,check_code,status,issue_count,details)
  values(v_batch.id,p_run_id,'INVENTORY_ON_HAND_MATCH',case when v_issues=0 then 'PASS' else 'FAIL' end,v_issues,jsonb_build_object('mismatched_products',v_issues));

  select coalesce(sum((p.delta->>'reserved_delta')::bigint),0) into v_expected
  from lihen_private.cutover_application_plan p where p.run_id=p_run_id and p.domain='ORDER' and p.operation_type='CREATE' and p.plan_status='READY';
  select coalesce(sum(s.stock_reserved),0) into v_actual from public.inventory_stock s;
  insert into lihen_private.cutover_post_verifications(batch_id,run_id,check_code,status,issue_count,details)
  values(v_batch.id,p_run_id,'ORDER_RESERVED_MATCH',case when v_actual=v_expected then 'PASS' else 'FAIL' end,abs((v_expected-v_actual)::integer),jsonb_build_object('expected_reserved',v_expected,'actual_reserved',v_actual));

  select coalesce(sum((p.delta->>'pending_in_delta')::bigint),0) into v_expected
  from lihen_private.cutover_application_plan p where p.run_id=p_run_id and p.domain='PURCHASE' and p.operation_type='CREATE' and p.plan_status='READY';
  select coalesce(sum(s.stock_pending),0) into v_actual from public.inventory_stock s;
  insert into lihen_private.cutover_post_verifications(batch_id,run_id,check_code,status,issue_count,details)
  values(v_batch.id,p_run_id,'PURCHASE_PENDING_MATCH',case when v_actual=v_expected then 'PASS' else 'FAIL' end,abs((v_expected-v_actual)::integer),jsonb_build_object('expected_pending',v_expected,'actual_pending',v_actual));

  select coalesce(sum((p.proposed_state->>'opening_balance')::numeric),0) into v_expected_numeric
  from lihen_private.cutover_application_plan p where p.run_id=p_run_id and p.domain='FINANCE' and p.operation_type='CREATE' and p.plan_status='READY';
  select coalesce(sum(b.balance),0) into v_actual_numeric
  from public.financial_account_balances b
  where b.account_id in (select p.canonical_entity_id from lihen_private.cutover_application_plan p where p.run_id=p_run_id and p.domain='FINANCE' and p.operation_type='CREATE' and p.plan_status='READY');
  insert into lihen_private.cutover_post_verifications(batch_id,run_id,check_code,status,issue_count,details)
  values(v_batch.id,p_run_id,'FINANCE_OPENING_BALANCE_MATCH',case when v_actual_numeric=v_expected_numeric then 'PASS' else 'FAIL' end,case when v_actual_numeric=v_expected_numeric then 0 else 1 end,jsonb_build_object('expected_balance',v_expected_numeric,'actual_balance',v_actual_numeric));

  select count(*)::integer into v_issues from public.orders o
  where o.id in (select p.canonical_entity_id from lihen_private.cutover_application_plan p where p.run_id=p_run_id and p.domain='ORDER' and p.operation_type='CREATE' and p.plan_status='READY')
    and o.status<>'CONFIRMED';
  insert into lihen_private.cutover_post_verifications(batch_id,run_id,check_code,status,issue_count,details)
  values(v_batch.id,p_run_id,'OPEN_ORDERS_CONFIRMED',case when v_issues=0 then 'PASS' else 'FAIL' end,v_issues,jsonb_build_object('not_confirmed',v_issues));

  select count(*)::integer into v_issues from public.purchases pu
  where pu.id in (select p.canonical_entity_id from lihen_private.cutover_application_plan p where p.run_id=p_run_id and p.domain='PURCHASE' and p.operation_type='CREATE' and p.plan_status='READY')
    and pu.status<>'CONFIRMED';
  insert into lihen_private.cutover_post_verifications(batch_id,run_id,check_code,status,issue_count,details)
  values(v_batch.id,p_run_id,'OPEN_PURCHASES_CONFIRMED',case when v_issues=0 then 'PASS' else 'FAIL' end,v_issues,jsonb_build_object('not_confirmed',v_issues));

  return query select v.check_code,v.status,v.issue_count,v.details from lihen_private.cutover_post_verifications v where v.batch_id=v_batch.id order by v.check_code;
end;$function$;

create or replace view public.cutover_post_verification_summary with (security_invoker=true) as
select b.run_id,b.id as batch_id,b.status as batch_status,
       count(v.*) as checks,
       count(v.*) filter(where v.status='PASS') as passed_checks,
       count(v.*) filter(where v.status='WARN') as warning_checks,
       count(v.*) filter(where v.status='FAIL') as failed_checks,
       case when b.status<>'APPLIED' then 'WAITING_FOR_CUTOVER'
            when count(v.*)=0 then 'WAITING_FOR_VERIFICATION'
            when count(v.*) filter(where v.status='FAIL')>0 then 'FAILED'
            else 'PASS' end as verification_status
from lihen_private.cutover_execution_batches b
left join lihen_private.cutover_post_verifications v on v.batch_id=b.id
group by b.run_id,b.id,b.status;

revoke all on function public.verify_phase3_cutover_controlled(uuid) from public,anon;
grant execute on function public.verify_phase3_cutover_controlled(uuid) to authenticated;
