-- H1 — Transactional Spine concurrency hardening
-- Unifies inventory advisory-lock namespace and prevents concurrent POS overselling.
-- Existing controlled RPC contracts and authorization model are preserved.

create or replace function public.record_inventory_adjustment_controlled(
  p_operation_key text,
  p_movement_id uuid,
  p_product_id uuid,
  p_quantity_delta integer,
  p_reason text,
  p_occurred_at timestamptz,
  p_notes text default null
)
returns table (
  movement_id uuid,
  product_id uuid,
  bucket text,
  quantity_delta integer,
  reason text,
  occurred_at timestamptz,
  stock_on_hand bigint,
  stock_reserved bigint,
  stock_pending bigint,
  stock_available bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_fingerprint text;
  v_existing lihen_private.inventory_write_operations%rowtype;
  v_on_hand bigint;
  v_reserved bigint;
  v_pending bigint;
  v_available bigint;
begin
  if v_actor_id is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor_id
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_INVENTORY_ADJUST_FORBIDDEN';
  end if;

  if p_operation_key is null or length(btrim(p_operation_key)) = 0 then
    raise exception using errcode='22023', message='LIHEN_OPERATION_KEY_REQUIRED';
  end if;
  if p_movement_id is null then
    raise exception using errcode='22023', message='LIHEN_INVENTORY_MOVEMENT_ID_REQUIRED';
  end if;
  if p_product_id is null or not exists(select 1 from public.products p where p.id=p_product_id) then
    raise exception using errcode='P0002', message='LIHEN_PRODUCT_NOT_FOUND';
  end if;
  if p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception using errcode='22023', message='LIHEN_INVENTORY_QUANTITY_DELTA_INVALID';
  end if;
  if p_reason not in (
    'PHYSICAL_COUNT_INCREASE',
    'PHYSICAL_COUNT_DECREASE',
    'DAMAGE_WRITE_OFF',
    'LOSS_WRITE_OFF',
    'RETURN_TO_STOCK',
    'MANUAL_CORRECTION'
  ) then
    raise exception using errcode='22023', message='LIHEN_INVENTORY_ADJUSTMENT_REASON_INVALID';
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode='22023', message='LIHEN_INVENTORY_OCCURRED_AT_INVALID';
  end if;

  v_fingerprint := md5(concat_ws('|',
    p_movement_id::text,
    p_product_id::text,
    p_quantity_delta::text,
    p_reason,
    p_occurred_at::text,
    coalesce(btrim(p_notes), '<NULL>')
  ));

  select o.* into v_existing
  from lihen_private.inventory_write_operations o
  where o.operation_key = btrim(p_operation_key);

  if found then
    if v_existing.operation_type <> 'ADJUST_ON_HAND'
       or v_existing.actor_id <> v_actor_id
       or v_existing.product_id <> p_product_id
       or v_existing.movement_id <> p_movement_id
       or v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception using errcode='23505', message='LIHEN_INVENTORY_WRITE_OPERATION_CONFLICT';
    end if;

    return query select
      (v_existing.result_snapshot->>'movement_id')::uuid,
      (v_existing.result_snapshot->>'product_id')::uuid,
      v_existing.result_snapshot->>'bucket',
      (v_existing.result_snapshot->>'quantity_delta')::integer,
      v_existing.result_snapshot->>'reason',
      (v_existing.result_snapshot->>'occurred_at')::timestamptz,
      (v_existing.result_snapshot->>'stock_on_hand')::bigint,
      (v_existing.result_snapshot->>'stock_reserved')::bigint,
      (v_existing.result_snapshot->>'stock_pending')::bigint,
      (v_existing.result_snapshot->>'stock_available')::bigint;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_product_id::text, 0));

  select s.stock_on_hand, s.stock_reserved, s.stock_pending, s.stock_available
    into v_on_hand, v_reserved, v_pending, v_available
  from public.inventory_stock s
  where s.product_id = p_product_id;

  v_on_hand := coalesce(v_on_hand, 0) + p_quantity_delta;
  v_reserved := coalesce(v_reserved, 0);
  v_pending := coalesce(v_pending, 0);
  v_available := v_on_hand - v_reserved;

  if v_on_hand < 0 then
    raise exception using errcode='23514', message='LIHEN_INVENTORY_ON_HAND_NEGATIVE';
  end if;
  if v_available < 0 then
    raise exception using errcode='23514', message='LIHEN_INVENTORY_AVAILABLE_NEGATIVE';
  end if;

  insert into public.inventory_movements(
    id, product_id, bucket, quantity_delta, reason, occurred_at, notes
  ) values (
    p_movement_id, p_product_id, 'ON_HAND', p_quantity_delta, p_reason,
    p_occurred_at, nullif(btrim(p_notes), '')
  );

  insert into lihen_private.inventory_write_operations(
    operation_key, operation_type, actor_id, product_id, movement_id,
    request_fingerprint, result_snapshot
  ) values (
    btrim(p_operation_key), 'ADJUST_ON_HAND', v_actor_id, p_product_id, p_movement_id,
    v_fingerprint,
    jsonb_build_object(
      'movement_id', p_movement_id,
      'product_id', p_product_id,
      'bucket', 'ON_HAND',
      'quantity_delta', p_quantity_delta,
      'reason', p_reason,
      'occurred_at', p_occurred_at,
      'stock_on_hand', v_on_hand,
      'stock_reserved', v_reserved,
      'stock_pending', v_pending,
      'stock_available', v_available
    )
  );

  return query select p_movement_id, p_product_id, 'ON_HAND'::text, p_quantity_delta,
    p_reason, p_occurred_at, v_on_hand, v_reserved, v_pending, v_available;
end;
$$;

revoke all on function public.record_inventory_adjustment_controlled(text,uuid,uuid,integer,text,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.record_inventory_adjustment_controlled(text,uuid,uuid,integer,text,timestamptz,text)
  to authenticated;
grant execute on function public.record_inventory_adjustment_controlled(text,uuid,uuid,integer,text,timestamptz,text)
  to service_role;

create or replace function public.create_pos_sale_controlled(
 p_operation_key text,p_sale_id uuid,p_sale_number text,p_financial_account_id uuid,p_channel text,p_customer_name text,p_customer_phone text,p_occurred_at timestamptz,p_notes text,p_items jsonb
) returns table(sale_id uuid,sale_number text,total_amount numeric,status text)
language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=auth.uid(); v_fp text; v_existing lihen_private.sale_write_operations%rowtype; v_total numeric:=0; v_line jsonb; v_pid uuid; v_qty int; v_price numeric; v_item_id uuid; v_balance record; v_movement_id uuid:=gen_random_uuid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_SALE_FORBIDDEN'; end if;
 if p_operation_key is null or btrim(p_operation_key)='' or p_sale_id is null or p_financial_account_id is null or p_sale_number is null or btrim(p_sale_number)='' or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception using errcode='22023',message='LIHEN_POS_FIELDS_REQUIRED'; end if;
 if p_channel not in('WHATSAPP','INSTAGRAM','FACEBOOK','TIKTOK','WEB','IN_PERSON','OTHER') then raise exception using errcode='22023',message='LIHEN_SALE_CHANNEL_INVALID'; end if;
 if not exists(select 1 from public.financial_accounts a where a.id=p_financial_account_id and a.status='ACTIVE') then raise exception using errcode='23503',message='LIHEN_FINANCIAL_ACCOUNT_NOT_ACTIVE'; end if;
 v_fp:=md5(concat_ws('|',p_sale_id::text,btrim(p_sale_number),p_financial_account_id::text,p_channel,coalesce(p_customer_name,''),coalesce(p_customer_phone,''),p_occurred_at::text,coalesce(p_notes,''),p_items::text));
 select * into v_existing from lihen_private.sale_write_operations where operation_key=btrim(p_operation_key);
 if found then if v_existing.operation_type<>'POS_SALE' or v_existing.actor_id<>v_actor or v_existing.request_fingerprint is distinct from v_fp then raise exception using errcode='23505',message='LIHEN_SALE_OPERATION_CONFLICT'; end if; return query select s.id,s.sale_number,s.total_amount,s.status from public.sales s where s.id=v_existing.sale_id; return; end if;
 create temporary table if not exists pg_temp.lihen_pos_lines(item_id uuid,product_id uuid,quantity int,unit_price numeric) on commit drop; truncate pg_temp.lihen_pos_lines;
 for v_line in select value from jsonb_array_elements(p_items) loop
   v_item_id:=(v_line->>'id')::uuid;v_pid:=(v_line->>'product_id')::uuid;v_qty:=(v_line->>'quantity')::int;v_price:=(v_line->>'unit_price')::numeric;
   if v_item_id is null or v_pid is null or v_qty<=0 or v_price<0 then raise exception using errcode='22023',message='LIHEN_POS_ITEM_INVALID'; end if;
   if exists(select 1 from pg_temp.lihen_pos_lines where product_id=v_pid) then raise exception using errcode='23505',message='LIHEN_POS_DUPLICATE_PRODUCT'; end if;
   if not exists(select 1 from public.products where id=v_pid) then raise exception using errcode='23503',message='LIHEN_PRODUCT_NOT_FOUND'; end if;
   insert into pg_temp.lihen_pos_lines values(v_item_id,v_pid,v_qty,v_price);v_total:=v_total+(v_qty*v_price);
 end loop;

  -- H1 hardening: all availability-sensitive writes share the product lock namespace.
  -- Product ordering makes multi-product lock acquisition deterministic.
  for v_line in
    select to_jsonb(x)
    from pg_temp.lihen_pos_lines x
    order by x.product_id
  loop
    v_pid := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'quantity')::int;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_pid::text, 0)
    );

    select *
      into v_balance
    from public.inventory_stock
    where product_id = v_pid;

    if coalesce(v_balance.stock_available, 0) < v_qty then
      raise exception using
        errcode='22023',
        message='LIHEN_STOCK_INSUFFICIENT';
    end if;
  end loop;

insert into public.sales(id,sale_number,channel,status,customer_name,customer_phone,occurred_at,total_amount,financial_account_id,notes)
 values(p_sale_id,btrim(p_sale_number),p_channel,'COMPLETED',nullif(btrim(coalesce(p_customer_name,'')),''),nullif(btrim(coalesce(p_customer_phone,'')),''),coalesce(p_occurred_at,now()),v_total,p_financial_account_id,nullif(btrim(coalesce(p_notes,'')),''));
 for v_line in select to_jsonb(x) from pg_temp.lihen_pos_lines x loop
   v_item_id:=(v_line->>'item_id')::uuid;v_pid:=(v_line->>'product_id')::uuid;v_qty:=(v_line->>'quantity')::int;v_price:=(v_line->>'unit_price')::numeric;
   insert into public.sale_items(id,sale_id,product_id,quantity,unit_price) values(v_item_id,p_sale_id,v_pid,v_qty,v_price);
   insert into public.inventory_movements(product_id,bucket,quantity_delta,reason,occurred_at,external_reference,notes) values(v_pid,'ON_HAND',-v_qty,'POS_SALE_COMPLETED',coalesce(p_occurred_at,now()),p_sale_id::text,'Salida física por venta POS');
 end loop;
 insert into public.financial_movements(id,account_id,movement_type,amount_signed,occurred_at,description,reference_type,reference_id) values(v_movement_id,p_financial_account_id,'SALE_INCOME',v_total,coalesce(p_occurred_at,now()),'Ingreso por venta POS '||btrim(p_sale_number),'SALE',p_sale_id);
 insert into lihen_private.sale_write_operations(operation_key,operation_type,actor_id,sale_id,request_fingerprint,result_snapshot) values(btrim(p_operation_key),'POS_SALE',v_actor,p_sale_id,v_fp,jsonb_build_object('sale_id',p_sale_id,'total_amount',v_total,'financial_movement_id',v_movement_id));
 return query select s.id,s.sale_number,s.total_amount,s.status from public.sales s where s.id=p_sale_id;
end;$fn$;
revoke all on function public.create_pos_sale_controlled(text,uuid,text,uuid,text,text,text,timestamptz,text,jsonb) from public,anon;
grant execute on function public.create_pos_sale_controlled(text,uuid,text,uuid,text,text,text,timestamptz,text,jsonb) to authenticated,service_role;
