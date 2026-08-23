create or replace function public.set_product_initial_cost_controlled(
  p_operation_key text,
  p_history_id uuid,
  p_product_id uuid,
  p_unit_cost numeric,
  p_effective_at timestamptz,
  p_notes text
)
returns table(
  product_id uuid,
  current_cost numeric,
  history_id uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_fp text;
  v_existing lihen_private.product_write_operations%rowtype;
  v_cost numeric;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_PRODUCT_COST_FORBIDDEN';
  end if;
  if p_operation_key is null or btrim(p_operation_key)='' then
    raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED';
  end if;
  if p_history_id is null or p_product_id is null then
    raise exception using errcode='22023', message='LIHEN_PRODUCT_COST_ID_REQUIRED';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception using errcode='22023', message='LIHEN_PRODUCT_COST_INVALID';
  end if;
  if p_effective_at is null then
    raise exception using errcode='22023', message='LIHEN_PRODUCT_COST_EFFECTIVE_AT_REQUIRED';
  end if;
  if not exists(select 1 from public.products p where p.id=p_product_id and p.status='ACTIVE') then
    raise exception using errcode='23503', message='LIHEN_PRODUCT_NOT_FOUND';
  end if;

  v_fp := md5(concat_ws('|',p_history_id::text,p_product_id::text,p_unit_cost::text,p_effective_at::text,coalesce(btrim(p_notes),'')));
  select * into v_existing
  from lihen_private.product_write_operations
  where operation_key=btrim(p_operation_key);

  if found then
    if v_existing.operation_type<>'SET_INITIAL_COST'
       or v_existing.actor_id<>v_actor
       or v_existing.product_id<>p_product_id
       or v_existing.request_fingerprint is distinct from v_fp then
      raise exception using errcode='23505', message='LIHEN_PRODUCT_WRITE_OPERATION_CONFLICT';
    end if;
    select p.current_cost into v_cost from public.products p where p.id=p_product_id;
    return query select p_product_id,v_cost,p_history_id,true;
    return;
  end if;

  if exists(select 1 from public.product_cost_history h where h.id=p_history_id) then
    raise exception using errcode='23505', message='LIHEN_PRODUCT_COST_HISTORY_ALREADY_EXISTS';
  end if;
  if exists(select 1 from public.product_cost_history h where h.product_id=p_product_id) then
    raise exception using errcode='23514', message='LIHEN_INITIAL_COST_REQUIRES_NO_COST_HISTORY';
  end if;

  update public.products p
  set current_cost=p_unit_cost, updated_at=now()
  where p.id=p_product_id;

  insert into public.product_cost_history(
    id,product_id,purchase_id,purchase_item_id,supplier_id,unit_cost,currency,source,effective_at,notes
  ) values (
    p_history_id,p_product_id,null,null,null,p_unit_cost,'COP','LEGACY_RECONCILIATION',p_effective_at,
    nullif(btrim(coalesce(p_notes,'')),'')
  );

  insert into lihen_private.product_write_operations(
    operation_key,operation_type,actor_id,product_id,request_fingerprint,result_snapshot
  ) values (
    btrim(p_operation_key),'SET_INITIAL_COST',v_actor,p_product_id,v_fp,
    jsonb_build_object('product_id',p_product_id,'history_id',p_history_id,'unit_cost',p_unit_cost)
  );

  return query select p_product_id,p_unit_cost,p_history_id,false;
end;
$function$;

revoke all on function public.set_product_initial_cost_controlled(text,uuid,uuid,numeric,timestamptz,text) from public, anon;
grant execute on function public.set_product_initial_cost_controlled(text,uuid,uuid,numeric,timestamptz,text) to authenticated;
