create or replace function lihen_private.record_financial_opening_balance_cutover(
  p_actor uuid,
  p_operation_key text,
  p_movement_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_description text
)
returns table(movement_id uuid, account_id uuid, amount_signed numeric, balance numeric, replayed boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_fp text;
  v_existing lihen_private.financial_write_operations%rowtype;
  v_balance numeric;
begin
  if p_actor is null or not exists(
    select 1 from public.profiles p
    where p.id=p_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then raise exception using errcode='42501',message='LIHEN_FINANCE_FORBIDDEN'; end if;
  if p_operation_key is null or btrim(p_operation_key)='' then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_movement_id is null or p_account_id is null then raise exception using errcode='22023',message='LIHEN_OPENING_BALANCE_ID_REQUIRED'; end if;
  if p_amount is null or p_amount<=0 then raise exception using errcode='22023',message='LIHEN_OPENING_BALANCE_AMOUNT_INVALID'; end if;
  if p_occurred_at is null then raise exception using errcode='22023',message='LIHEN_OPENING_BALANCE_OCCURRED_AT_REQUIRED'; end if;
  if p_description is null or btrim(p_description)='' then raise exception using errcode='22023',message='LIHEN_OPENING_BALANCE_DESCRIPTION_REQUIRED'; end if;
  if not exists(select 1 from public.financial_accounts a where a.id=p_account_id and a.status='ACTIVE') then raise exception using errcode='23503',message='LIHEN_FINANCIAL_ACCOUNT_NOT_FOUND'; end if;

  v_fp:=md5(concat_ws('|',p_movement_id::text,p_account_id::text,p_amount::text,p_occurred_at::text,btrim(p_description)));
  select * into v_existing from lihen_private.financial_write_operations where operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'OPENING_BALANCE' or v_existing.actor_id<>p_actor or v_existing.account_id<>p_account_id or v_existing.movement_id<>p_movement_id or v_existing.request_fingerprint is distinct from v_fp then
      raise exception using errcode='23505',message='LIHEN_FINANCIAL_OPERATION_CONFLICT';
    end if;
    select b.balance into v_balance from public.financial_account_balances b where b.account_id=p_account_id;
    return query select p_movement_id,p_account_id,p_amount,v_balance,true; return;
  end if;

  if exists(select 1 from public.financial_movements m where m.id=p_movement_id) then raise exception using errcode='23505',message='LIHEN_FINANCIAL_MOVEMENT_ALREADY_EXISTS'; end if;
  if exists(select 1 from public.financial_movements m where m.account_id=p_account_id) then raise exception using errcode='23514',message='LIHEN_OPENING_BALANCE_REQUIRES_EMPTY_ACCOUNT'; end if;
  insert into public.financial_movements(id,account_id,movement_type,amount_signed,currency,occurred_at,description,reference_type,reference_id)
  values(p_movement_id,p_account_id,'ADJUSTMENT',p_amount,'COP',p_occurred_at,btrim(p_description),'OPENING_BALANCE',p_account_id);
  insert into lihen_private.financial_write_operations(operation_key,operation_type,actor_id,account_id,movement_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'OPENING_BALANCE',p_actor,p_account_id,p_movement_id,v_fp,jsonb_build_object('movement_id',p_movement_id,'account_id',p_account_id,'amount',p_amount,'kind','OPENING_BALANCE'));
  select b.balance into v_balance from public.financial_account_balances b where b.account_id=p_account_id;
  return query select p_movement_id,p_account_id,p_amount,v_balance,false;
end;$function$;

create or replace function lihen_private.set_product_initial_cost_cutover(
  p_actor uuid,
  p_operation_key text,
  p_history_id uuid,
  p_product_id uuid,
  p_unit_cost numeric,
  p_effective_at timestamptz,
  p_notes text
)
returns table(product_id uuid,current_cost numeric,history_id uuid,replayed boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_fp text;
  v_existing lihen_private.product_write_operations%rowtype;
  v_cost numeric;
begin
  if p_actor is null or not exists(
    select 1 from public.profiles p
    where p.id=p_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then raise exception using errcode='42501',message='LIHEN_PRODUCT_COST_FORBIDDEN'; end if;
  if p_operation_key is null or btrim(p_operation_key)='' then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_history_id is null or p_product_id is null then raise exception using errcode='22023',message='LIHEN_PRODUCT_COST_ID_REQUIRED'; end if;
  if p_unit_cost is null or p_unit_cost<0 then raise exception using errcode='22023',message='LIHEN_PRODUCT_COST_INVALID'; end if;
  if p_effective_at is null then raise exception using errcode='22023',message='LIHEN_PRODUCT_COST_EFFECTIVE_AT_REQUIRED'; end if;
  if not exists(select 1 from public.products p where p.id=p_product_id and p.status='ACTIVE') then raise exception using errcode='23503',message='LIHEN_PRODUCT_NOT_FOUND'; end if;

  v_fp:=md5(concat_ws('|',p_history_id::text,p_product_id::text,p_unit_cost::text,p_effective_at::text,coalesce(btrim(p_notes),'')));
  select * into v_existing from lihen_private.product_write_operations where operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'SET_INITIAL_COST' or v_existing.actor_id<>p_actor or v_existing.product_id<>p_product_id or v_existing.request_fingerprint is distinct from v_fp then
      raise exception using errcode='23505',message='LIHEN_PRODUCT_WRITE_OPERATION_CONFLICT';
    end if;
    select p.current_cost into v_cost from public.products p where p.id=p_product_id;
    return query select p_product_id,v_cost,p_history_id,true; return;
  end if;

  if exists(select 1 from public.product_cost_history h where h.id=p_history_id) then raise exception using errcode='23505',message='LIHEN_PRODUCT_COST_HISTORY_ALREADY_EXISTS'; end if;
  if exists(select 1 from public.product_cost_history h where h.product_id=p_product_id) then raise exception using errcode='23514',message='LIHEN_INITIAL_COST_REQUIRES_NO_COST_HISTORY'; end if;
  update public.products p set current_cost=p_unit_cost,updated_at=now() where p.id=p_product_id;
  insert into public.product_cost_history(id,product_id,purchase_id,purchase_item_id,supplier_id,unit_cost,currency,source,effective_at,notes)
  values(p_history_id,p_product_id,null,null,null,p_unit_cost,'COP','LEGACY_RECONCILIATION',p_effective_at,nullif(btrim(coalesce(p_notes,'')),''));
  insert into lihen_private.product_write_operations(operation_key,operation_type,actor_id,product_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'SET_INITIAL_COST',p_actor,p_product_id,v_fp,jsonb_build_object('product_id',p_product_id,'history_id',p_history_id,'unit_cost',p_unit_cost));
  return query select p_product_id,p_unit_cost,p_history_id,false;
end;$function$;

revoke all on function lihen_private.record_financial_opening_balance_cutover(uuid,text,uuid,uuid,numeric,timestamptz,text) from public, anon, authenticated;
revoke all on function lihen_private.set_product_initial_cost_cutover(uuid,text,uuid,uuid,numeric,timestamptz,text) from public, anon, authenticated;

drop function if exists public.record_financial_opening_balance_controlled(text,uuid,uuid,numeric,timestamptz,text);
drop function if exists public.set_product_initial_cost_controlled(text,uuid,uuid,numeric,timestamptz,text);
