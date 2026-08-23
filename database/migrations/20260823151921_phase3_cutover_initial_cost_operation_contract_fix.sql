alter table lihen_private.product_write_operations
  drop constraint if exists product_write_operations_type_check;

alter table lihen_private.product_write_operations
  add constraint product_write_operations_type_check
  check (operation_type = any (array[
    'CREATE_PRODUCT'::text,
    'UPDATE_PRODUCT'::text,
    'CHANGE_PRODUCT_SALE_PRICE'::text,
    'SET_INITIAL_COST'::text
  ]));

create or replace function public.retry_phase3_cutover_batch_controlled(p_run_id uuid)
returns table(run_id uuid,batch_id uuid,batch_status text,retry_ready boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_run lihen_private.cutover_runs%rowtype;
  v_batch lihen_private.cutover_execution_batches%rowtype;
  v_receipts bigint;
begin
  if v_actor is null then
    raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED';
  end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code='OWNER'
  ) then
    raise exception using errcode='42501',message='LIHEN_CUTOVER_RETRY_OWNER_REQUIRED';
  end if;

  select * into v_run
  from lihen_private.cutover_runs r
  where r.id=p_run_id
  for update;

  if not found then
    raise exception using errcode='P0002',message='LIHEN_CUTOVER_RUN_NOT_FOUND';
  end if;

  if v_run.status<>'APPROVED' or v_run.approved_by<>v_actor then
    raise exception using errcode='22023',message='LIHEN_CUTOVER_RETRY_SAME_OWNER_APPROVAL_REQUIRED';
  end if;

  select * into v_batch
  from lihen_private.cutover_execution_batches b
  where b.run_id=p_run_id
  for update;

  if not found then
    raise exception using errcode='P0002',message='LIHEN_CUTOVER_BATCH_NOT_FOUND';
  end if;

  select count(*) into v_receipts
  from lihen_private.cutover_execution_receipts r
  where r.batch_id=v_batch.id;

  if v_batch.status<>'FAILED' then
    raise exception using errcode='22023',message='LIHEN_CUTOVER_BATCH_NOT_FAILED';
  end if;

  if v_receipts<>0 then
    raise exception using errcode='23514',message='LIHEN_CUTOVER_RETRY_REQUIRES_ZERO_RECEIPTS';
  end if;

  if v_batch.armed_by<>v_actor then
    raise exception using errcode='22023',message='LIHEN_CUTOVER_RETRY_SAME_OWNER_ARM_REQUIRED';
  end if;

  update lihen_private.cutover_execution_batches b
  set status='ARMED',
      started_at=null,
      completed_at=null
  where b.id=v_batch.id
  returning b.id,b.status into batch_id,batch_status;

  run_id:=p_run_id;
  retry_ready:=true;
  return next;
end;
$function$;

revoke all on function public.retry_phase3_cutover_batch_controlled(uuid) from public,anon;
grant execute on function public.retry_phase3_cutover_batch_controlled(uuid) to authenticated;
