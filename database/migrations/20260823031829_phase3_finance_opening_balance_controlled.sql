create or replace function public.record_financial_opening_balance_controlled(
  p_operation_key text,
  p_movement_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_description text
)
returns table(
  movement_id uuid,
  account_id uuid,
  amount_signed numeric,
  balance numeric,
  replayed boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_fp text;
  v_existing lihen_private.financial_write_operations%rowtype;
  v_balance numeric;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_FINANCE_FORBIDDEN';
  end if;
  if p_operation_key is null or btrim(p_operation_key)='' then
    raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED';
  end if;
  if p_movement_id is null or p_account_id is null then
    raise exception using errcode='22023', message='LIHEN_OPENING_BALANCE_ID_REQUIRED';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception using errcode='22023', message='LIHEN_OPENING_BALANCE_AMOUNT_INVALID';
  end if;
  if p_occurred_at is null then
    raise exception using errcode='22023', message='LIHEN_OPENING_BALANCE_OCCURRED_AT_REQUIRED';
  end if;
  if p_description is null or btrim(p_description)='' then
    raise exception using errcode='22023', message='LIHEN_OPENING_BALANCE_DESCRIPTION_REQUIRED';
  end if;
  if not exists(select 1 from public.financial_accounts a where a.id=p_account_id and a.status='ACTIVE') then
    raise exception using errcode='23503', message='LIHEN_FINANCIAL_ACCOUNT_NOT_FOUND';
  end if;

  v_fp := md5(concat_ws('|',p_movement_id::text,p_account_id::text,p_amount::text,p_occurred_at::text,btrim(p_description)));
  select * into v_existing
  from lihen_private.financial_write_operations
  where operation_key=btrim(p_operation_key);

  if found then
    if v_existing.operation_type<>'OPENING_BALANCE'
       or v_existing.actor_id<>v_actor
       or v_existing.account_id<>p_account_id
       or v_existing.movement_id<>p_movement_id
       or v_existing.request_fingerprint is distinct from v_fp then
      raise exception using errcode='23505', message='LIHEN_FINANCIAL_OPERATION_CONFLICT';
    end if;
    select b.balance into v_balance from public.financial_account_balances b where b.account_id=p_account_id;
    return query select p_movement_id,p_account_id,p_amount,v_balance,true;
    return;
  end if;

  if exists(select 1 from public.financial_movements m where m.id=p_movement_id) then
    raise exception using errcode='23505', message='LIHEN_FINANCIAL_MOVEMENT_ALREADY_EXISTS';
  end if;
  if exists(select 1 from public.financial_movements m where m.account_id=p_account_id) then
    raise exception using errcode='23514', message='LIHEN_OPENING_BALANCE_REQUIRES_EMPTY_ACCOUNT';
  end if;

  insert into public.financial_movements(
    id,account_id,movement_type,amount_signed,currency,occurred_at,description,reference_type,reference_id
  ) values (
    p_movement_id,p_account_id,'ADJUSTMENT',p_amount,'COP',p_occurred_at,btrim(p_description),'OPENING_BALANCE',p_account_id
  );

  insert into lihen_private.financial_write_operations(
    operation_key,operation_type,actor_id,account_id,movement_id,request_fingerprint,result_snapshot
  ) values (
    btrim(p_operation_key),'OPENING_BALANCE',v_actor,p_account_id,p_movement_id,v_fp,
    jsonb_build_object('movement_id',p_movement_id,'account_id',p_account_id,'amount',p_amount,'kind','OPENING_BALANCE')
  );

  select b.balance into v_balance from public.financial_account_balances b where b.account_id=p_account_id;
  return query select p_movement_id,p_account_id,p_amount,v_balance,false;
end;
$function$;

revoke all on function public.record_financial_opening_balance_controlled(text,uuid,uuid,numeric,timestamptz,text) from public, anon;
grant execute on function public.record_financial_opening_balance_controlled(text,uuid,uuid,numeric,timestamptz,text) to authenticated;
