create or replace function public.execute_phase3_cutover_controlled(p_run_id uuid)
returns table(run_id uuid,batch_id uuid,status text,applied_receipts bigint,skipped_receipts bigint)
language plpgsql security definer set search_path to '' as $function$
declare
  v_actor uuid:=auth.uid();
  v_run lihen_private.cutover_runs%rowtype;
  v_batch lihen_private.cutover_execution_batches%rowtype;
  p lihen_private.cutover_application_plan%rowtype;
  s jsonb;
  v_key text;
  v_applied bigint:=0;
  v_skipped bigint:=0;
  v_error text;
  v_sqlstate text;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles x where x.id=v_actor and x.authorization_status='ACTIVE' and x.role_code='OWNER') then
    raise exception using errcode='42501',message='LIHEN_CUTOVER_EXECUTE_OWNER_REQUIRED';
  end if;
  select * into v_run from lihen_private.cutover_runs r where r.id=p_run_id for update;
  if not found then raise exception using errcode='P0002',message='LIHEN_CUTOVER_RUN_NOT_FOUND'; end if;
  if v_run.status='APPLIED' then
    select * into v_batch from lihen_private.cutover_execution_batches b where b.run_id=p_run_id;
    return query select p_run_id,v_batch.id,'APPLIED'::text,
      count(*) filter(where r.status='APPLIED'),count(*) filter(where r.status='SKIPPED')
      from lihen_private.cutover_execution_receipts r where r.batch_id=v_batch.id; return;
  end if;
  if v_run.status<>'APPROVED' or v_run.approved_by<>v_actor then
    raise exception using errcode='22023',message='LIHEN_CUTOVER_SAME_OWNER_APPROVAL_REQUIRED';
  end if;
  if not exists(select 1 from public.cutover_dry_run_summary d where d.run_id=p_run_id and d.gate_status='READY_FOR_CUTOVER' and d.blocked_operations=0 and d.validation_failures=0) then
    raise exception using errcode='22023',message='LIHEN_CUTOVER_GATE_NOT_READY';
  end if;
  select * into v_batch from lihen_private.cutover_execution_batches b where b.run_id=p_run_id for update;
  if not found or v_batch.status<>'ARMED' or v_batch.armed_by<>v_actor then
    raise exception using errcode='22023',message='LIHEN_CUTOVER_BATCH_NOT_ARMED_BY_OWNER';
  end if;
  if v_batch.source_sha256<>v_run.source_sha256 then raise exception using errcode='23514',message='LIHEN_CUTOVER_BATCH_SOURCE_MISMATCH'; end if;

  update lihen_private.cutover_execution_batches set status='APPLYING',started_at=now(),failure_reason=null where id=v_batch.id;
  update lihen_private.cutover_runs set status='APPLYING' where id=p_run_id;

  begin
    for p in
      select q.* from lihen_private.cutover_application_plan q
      where q.run_id=p_run_id
      order by case q.domain when 'PRODUCT' then 10 when 'SUPPLIER' then 20 when 'CUSTOMER' then 30 when 'FINANCE' then 40 when 'INVENTORY' then 50 when 'PURCHASE' then 60 when 'ORDER' then 70 when 'SALE' then 80 else 90 end,
               q.source_row_key
    loop
      if exists(select 1 from lihen_private.cutover_execution_receipts r where r.batch_id=v_batch.id and r.plan_id=p.id) then
        continue;
      end if;
      s:=coalesce(p.proposed_state,'{}'::jsonb);
      v_key:='phase3:'||p_run_id::text||':'||p.domain||':'||p.id::text;

      if p.plan_status='SKIPPED' or p.operation_type in ('NOOP','LINK') then
        insert into lihen_private.cutover_execution_receipts(batch_id,run_id,plan_id,domain,operation_type,status,canonical_entity_type,canonical_entity_id,before_state,after_state,error_detail)
        values(v_batch.id,p_run_id,p.id,p.domain,p.operation_type,'SKIPPED',p.canonical_entity_type,p.canonical_entity_id,p.current_state,p.proposed_state,'{}'::jsonb);
        v_skipped:=v_skipped+1;

      elsif p.domain='PRODUCT' and p.operation_type='CREATE' then
        perform 1 from public.create_product_controlled(v_key||':create',
          (s->>'id')::uuid,nullif(s->>'sku',''),nullif(s->>'catalog_code',''),s->>'slug',s->>'name',s->>'business_line',
          nullif(s->>'brand_id','')::uuid,nullif(s->>'category_id','')::uuid,s->>'status',(s->>'sale_price')::numeric);
        if s ? 'current_cost' and s->>'current_cost' is not null then
          perform 1 from lihen_private.set_product_initial_cost_cutover(v_actor,v_key||':cost',p.id,(s->>'id')::uuid,(s->>'current_cost')::numeric,v_run.snapshot_at,'Phase 3 legacy opening cost');
        end if;
        insert into lihen_private.cutover_execution_receipts(batch_id,run_id,plan_id,domain,operation_type,status,canonical_entity_type,canonical_entity_id,before_state,after_state,error_detail)
        values(v_batch.id,p_run_id,p.id,p.domain,p.operation_type,'APPLIED',p.canonical_entity_type,(s->>'id')::uuid,p.current_state,s,'{}'::jsonb); v_applied:=v_applied+1;

      elsif p.domain='SUPPLIER' and p.operation_type='CREATE' then
        perform 1 from public.create_supplier_controlled(v_key||':create',(s->>'id')::uuid,s->>'business_name',null,null,null,nullif(s->>'city',''),nullif(s->>'average_delivery_days','')::integer,null,s->>'status');
        insert into lihen_private.cutover_execution_receipts(batch_id,run_id,plan_id,domain,operation_type,status,canonical_entity_type,canonical_entity_id,before_state,after_state,error_detail)
        values(v_batch.id,p_run_id,p.id,p.domain,p.operation_type,'APPLIED',p.canonical_entity_type,(s->>'id')::uuid,p.current_state,s,'{}'::jsonb); v_applied:=v_applied+1;

      elsif p.domain='CUSTOMER' and p.operation_type='CREATE' then
        perform 1 from public.create_customer_controlled(v_key||':create',(s->>'id')::uuid,s->>'full_name',s->>'whatsapp',s->>'email',s->>'document_number',s->>'notes',s->>'status');
        insert into lihen_private.cutover_execution_receipts(batch_id,run_id,plan_id,domain,operation_type,status,canonical_entity_type,canonical_entity_id,before_state,after_state,error_detail)
        values(v_batch.id,p_run_id,p.id,p.domain,p.operation_type,'APPLIED',p.canonical_entity_type,(s->>'id')::uuid,p.current_state,s,'{}'::jsonb); v_applied:=v_applied+1;

      elsif p.domain='FINANCE' and p.operation_type='CREATE' then
        perform 1 from public.create_financial_account_controlled(v_key||':create',(s->>'id')::uuid,s->>'code',s->>'name',s->>'account_type',s->>'currency');
        if coalesce((s->>'opening_balance')::numeric,0)>0 then
          perform 1 from lihen_private.record_financial_opening_balance_cutover(v_actor,v_key||':opening',p.id,(s->>'id')::uuid,(s->>'opening_balance')::numeric,v_run.snapshot_at,'Phase 3 opening balance from validated legacy snapshot');
        end if;
        insert into lihen_private.cutover_execution_receipts(batch_id,run_id,plan_id,domain,operation_type,status,canonical_entity_type,canonical_entity_id,before_state,after_state,error_detail)
        values(v_batch.id,p_run_id,p.id,p.domain,p.operation_type,'APPLIED',p.canonical_entity_type,(s->>'id')::uuid,p.current_state,s,'{}'::jsonb); v_applied:=v_applied+1;

      elsif p.domain='INVENTORY' and p.operation_type='ADJUST' then
        perform 1 from public.record_inventory_adjustment_controlled(v_key||':adjust',p.id,p.canonical_entity_id,(p.delta->>'on_hand_delta')::integer,
          case when (p.delta->>'on_hand_delta')::integer>0 then 'PHYSICAL_COUNT_INCREASE' else 'PHYSICAL_COUNT_DECREASE' end,
          v_run.snapshot_at,'Phase 3 opening inventory from validated legacy snapshot');
        insert into lihen_private.cutover_execution_receipts(batch_id,run_id,plan_id,domain,operation_type,status,canonical_entity_type,canonical_entity_id,before_state,after_state,error_detail)
        values(v_batch.id,p_run_id,p.id,p.domain,p.operation_type,'APPLIED',p.canonical_entity_type,p.canonical_entity_id,p.current_state,p.proposed_state,'{}'::jsonb); v_applied:=v_applied+1;

      elsif p.domain='PURCHASE' and p.operation_type='CREATE' then
        perform 1 from public.create_purchase_draft_controlled(v_key||':draft',(s->>'id')::uuid,s->>'purchase_number',(s->>'supplier_id')::uuid,
          nullif(s->>'purchase_date','')::date,nullif(s->>'expected_date','')::date,s->>'source_notes',s->'items');
        perform 1 from public.confirm_purchase_controlled(v_key||':confirm',(s->>'id')::uuid,v_run.snapshot_at);
        insert into lihen_private.cutover_execution_receipts(batch_id,run_id,plan_id,domain,operation_type,status,canonical_entity_type,canonical_entity_id,before_state,after_state,error_detail)
        values(v_batch.id,p_run_id,p.id,p.domain,p.operation_type,'APPLIED',p.canonical_entity_type,(s->>'id')::uuid,p.current_state,s,'{}'::jsonb); v_applied:=v_applied+1;

      elsif p.domain='ORDER' and p.operation_type='CREATE' then
        perform 1 from public.create_order_draft_controlled(v_key||':draft',(s->>'id')::uuid,s->>'order_number',s->>'channel',s->>'customer_name',s->>'customer_phone',s->>'notes',nullif(s->>'requested_at','')::timestamptz,s->'items');
        perform 1 from public.assign_order_customer_controlled(v_key||':customer',(s->>'id')::uuid,(s->>'customer_id')::uuid);
        perform 1 from public.set_order_commercial_terms_controlled(v_key||':terms',(s->>'id')::uuid,(s->>'subtotal')::numeric,s->>'discount_type',(s->>'discount_value')::numeric,(s->>'discount_amount')::numeric,(s->>'delivery_cost')::numeric,(s->>'total')::numeric,s->>'payment_status');
        perform 1 from public.confirm_order_controlled(v_key||':confirm',(s->>'id')::uuid,v_run.snapshot_at);
        insert into lihen_private.cutover_execution_receipts(batch_id,run_id,plan_id,domain,operation_type,status,canonical_entity_type,canonical_entity_id,before_state,after_state,error_detail)
        values(v_batch.id,p_run_id,p.id,p.domain,p.operation_type,'APPLIED',p.canonical_entity_type,(s->>'id')::uuid,p.current_state,s,'{}'::jsonb); v_applied:=v_applied+1;

      else
        raise exception using errcode='0A000',message='LIHEN_CUTOVER_PLAN_OPERATION_UNSUPPORTED',detail=p.domain||'/'||p.operation_type||'/'||p.plan_status;
      end if;
    end loop;

    if (select count(*) from lihen_private.cutover_execution_receipts r where r.batch_id=v_batch.id) <>
       (select count(*) from lihen_private.cutover_application_plan q where q.run_id=p_run_id) then
      raise exception using errcode='23514',message='LIHEN_CUTOVER_RECEIPT_COVERAGE_MISMATCH';
    end if;

    update lihen_private.cutover_execution_batches set status='APPLIED',completed_at=now() where id=v_batch.id;
    update lihen_private.cutover_runs set status='APPLIED',applied_at=now() where id=p_run_id;
  exception when others then
    get stacked diagnostics v_error=message_text,v_sqlstate=returned_sqlstate;
    update lihen_private.cutover_execution_batches
    set status='FAILED',
        failure_reason=concat_ws('|',
          'SQLSTATE='||coalesce(v_sqlstate,'<NULL>'),
          'DOMAIN='||coalesce(p.domain,'<NONE>'),
          'OPERATION='||coalesce(p.operation_type,'<NONE>'),
          'PLAN_STATUS='||coalesce(p.plan_status,'<NONE>'),
          'PLAN_ID='||coalesce(p.id::text,'<NONE>'),
          'SOURCE_ROW_KEY='||coalesce(p.source_row_key,'<NONE>'),
          'MESSAGE='||coalesce(v_error,'<NULL>')
        ),
        completed_at=now()
    where id=v_batch.id;
    update lihen_private.cutover_runs set status='APPROVED' where id=p_run_id;
    return query select p_run_id,v_batch.id,'FAILED'::text,0::bigint,0::bigint;
    return;
  end;

  return query select p_run_id,v_batch.id,'APPLIED'::text,v_applied,v_skipped;
end;$function$;

revoke all on function public.execute_phase3_cutover_controlled(uuid) from public,anon;
grant execute on function public.execute_phase3_cutover_controlled(uuid) to authenticated;
