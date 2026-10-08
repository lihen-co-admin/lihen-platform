-- SALES-POS-CUSTOMER-LINKAGE
-- LOCAL CANDIDATE ONLY — NOT APPLIED
-- Based on effective Supabase DEV RPC definitions.
-- Preserve historical rows and anonymous POS.
-- Customer Benefits eligibility remains unchanged.

do $precheck$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='orders'
      and column_name='customer_id'
  ) then
    raise exception 'LIHEN_ORDER_CUSTOMER_COLUMN_REQUIRED';
  end if;
end;
$precheck$;

alter table public.sales
  add column if not exists customer_id uuid;

do $fk$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid='public.sales'::regclass
      and conname='sales_customer_id_fkey'
  ) then
    alter table public.sales
      add constraint sales_customer_id_fkey
      foreign key(customer_id)
      references public.customers(id)
      on delete restrict;
  end if;
end;
$fk$;

create index if not exists sales_customer_id_idx
  on public.sales(customer_id);

-- Historical 10-argument POS RPC is unchanged.
-- New 11-argument controlled POS RPC.
CREATE OR REPLACE FUNCTION public.create_pos_sale_controlled(p_operation_key text, p_sale_id uuid, p_sale_number text, p_financial_account_id uuid, p_channel text, p_customer_name text, p_customer_phone text, p_occurred_at timestamp with time zone, p_notes text, p_items jsonb, p_customer_id uuid)
 RETURNS TABLE(sale_id uuid, sale_number text, total_amount numeric, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=auth.uid(); v_fp text; v_existing lihen_private.sale_write_operations%rowtype; v_total numeric:=0; v_line jsonb; v_pid uuid; v_qty int; v_price numeric; v_item_id uuid; v_balance record; v_movement_id uuid:=gen_random_uuid(); v_customer_name text; v_customer_phone text;
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_SALE_FORBIDDEN'; end if;
 if p_operation_key is null or btrim(p_operation_key)='' or p_sale_id is null or p_financial_account_id is null or p_sale_number is null or btrim(p_sale_number)='' or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception using errcode='22023',message='LIHEN_POS_FIELDS_REQUIRED'; end if;
 if p_channel not in('WHATSAPP','INSTAGRAM','FACEBOOK','TIKTOK','WEB','IN_PERSON','OTHER') then raise exception using errcode='22023',message='LIHEN_SALE_CHANNEL_INVALID'; end if;
 if not exists(select 1 from public.financial_accounts a where a.id=p_financial_account_id and a.status='ACTIVE') then raise exception using errcode='23503',message='LIHEN_FINANCIAL_ACCOUNT_NOT_ACTIVE'; end if;
 v_fp:=md5(concat_ws('|',p_sale_id::text,btrim(p_sale_number),p_financial_account_id::text,p_channel,case when p_customer_id is null then coalesce(p_customer_name,'') else '' end,case when p_customer_id is null then coalesce(p_customer_phone,'') else '' end,p_occurred_at::text,coalesce(p_notes,''),p_items::text));
  if p_customer_id is not null then
    v_fp := md5(v_fp || '|canonical-customer:' || p_customer_id::text);
  end if;
 select * into v_existing from lihen_private.sale_write_operations where operation_key=btrim(p_operation_key);
 if found then if v_existing.operation_type<>'POS_SALE' or v_existing.actor_id<>v_actor or v_existing.request_fingerprint is distinct from v_fp then raise exception using errcode='23505',message='LIHEN_SALE_OPERATION_CONFLICT'; end if; return query select s.id,s.sale_number,s.total_amount,s.status from public.sales s where s.id=v_existing.sale_id; return; end if;

  -- Only new operations resolve mutable Customer Master state.
  -- Existing retries are checked against their stable fingerprint.
  if p_customer_id is not null then
    select c.full_name, c.phone
      into v_customer_name, v_customer_phone
    from public.customers c
    where c.id = p_customer_id
      and c.status = 'ACTIVE'
    for share;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'LIHEN_ACTIVE_CUSTOMER_REQUIRED';
    end if;
  end if;

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

insert into public.sales(id,sale_number,channel,status,customer_name,customer_phone,customer_id,occurred_at,total_amount,financial_account_id,notes)
 values(p_sale_id,btrim(p_sale_number),p_channel,'COMPLETED',case when p_customer_id is null then nullif(btrim(coalesce(p_customer_name,'')),'') else v_customer_name end,case when p_customer_id is null then nullif(btrim(coalesce(p_customer_phone,'')),'') else v_customer_phone end,p_customer_id,coalesce(p_occurred_at,now()),v_total,p_financial_account_id,nullif(btrim(coalesce(p_notes,'')),''));
 for v_line in select to_jsonb(x) from pg_temp.lihen_pos_lines x loop
   v_item_id:=(v_line->>'item_id')::uuid;v_pid:=(v_line->>'product_id')::uuid;v_qty:=(v_line->>'quantity')::int;v_price:=(v_line->>'unit_price')::numeric;
   insert into public.sale_items(id,sale_id,product_id,quantity,unit_price) values(v_item_id,p_sale_id,v_pid,v_qty,v_price);
   insert into public.inventory_movements(product_id,bucket,quantity_delta,reason,occurred_at,external_reference,notes) values(v_pid,'ON_HAND',-v_qty,'POS_SALE_COMPLETED',coalesce(p_occurred_at,now()),p_sale_id::text,'Salida física por venta POS');
 end loop;
 insert into public.financial_movements(id,account_id,movement_type,amount_signed,occurred_at,description,reference_type,reference_id) values(v_movement_id,p_financial_account_id,'SALE_INCOME',v_total,coalesce(p_occurred_at,now()),'Ingreso por venta POS '||btrim(p_sale_number),'SALE',p_sale_id);
 insert into lihen_private.sale_write_operations(operation_key,operation_type,actor_id,sale_id,request_fingerprint,result_snapshot) values(btrim(p_operation_key),'POS_SALE',v_actor,p_sale_id,v_fp,jsonb_build_object('sale_id',p_sale_id,'total_amount',v_total,'financial_movement_id',v_movement_id));
 return query select s.id,s.sale_number,s.total_amount,s.status from public.sales s where s.id=p_sale_id;
end;$function$;

revoke all on function public.create_pos_sale_controlled(text,uuid,text,uuid,text,text,text,timestamptz,text,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_pos_sale_controlled(text,uuid,text,uuid,text,text,text,timestamptz,text,jsonb,uuid) to authenticated,service_role;

-- Existing 7-argument order RPC, with benefit logic preserved.
CREATE OR REPLACE FUNCTION public.complete_order_sale_controlled(p_operation_key text, p_sale_id uuid, p_sale_number text, p_order_id uuid, p_financial_account_id uuid, p_occurred_at timestamp with time zone, p_notes text)
 RETURNS TABLE(sale_id uuid, sale_number text, order_id uuid, total_amount numeric, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_fp text;
  v_existing lihen_private.sale_write_operations%rowtype;
  v_order public.orders%rowtype;
  v_items_subtotal numeric := 0;
  v_total numeric := 0;
  v_item record;
  v_balance record;
  v_movement_id uuid := gen_random_uuid();
  v_application public.order_customer_benefit_applications%rowtype;
  v_applied_discount numeric := 0;
  v_redemption record;
begin
  if v_actor is null then
    raise exception using
      errcode='42501',
      message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists(
    select 1
    from public.profiles p
    where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using
      errcode='42501',
      message='LIHEN_SALE_FORBIDDEN';
  end if;

  if p_operation_key is null
     or btrim(p_operation_key)=''
     or p_sale_id is null
     or p_order_id is null
     or p_financial_account_id is null
     or p_sale_number is null
     or btrim(p_sale_number)='' then
    raise exception using
      errcode='22023',
      message='LIHEN_SALE_FIELDS_REQUIRED';
  end if;

  if not exists(
    select 1
    from public.financial_accounts a
    where a.id=p_financial_account_id
      and a.status='ACTIVE'
  ) then
    raise exception using
      errcode='23503',
      message='LIHEN_FINANCIAL_ACCOUNT_NOT_ACTIVE';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id=p_order_id
  for update;

  if not found then
    raise exception using
      errcode='P0002',
      message='LIHEN_ORDER_NOT_FOUND';
  end if;

  if v_order.status not in ('CONFIRMED','PREPARING','READY') then
    raise exception using
      errcode='22023',
      message='LIHEN_ORDER_NOT_SELLABLE';
  end if;

  if not exists(
    select 1
    from public.order_items oi0
    where oi0.order_id=p_order_id
  ) then
    raise exception using
      errcode='22023',
      message='LIHEN_ORDER_EMPTY';
  end if;

  v_fp := md5(concat_ws(
    '|',
    p_sale_id::text,
    btrim(p_sale_number),
    p_order_id::text,
    p_financial_account_id::text,
    p_occurred_at::text,
    coalesce(p_notes,'')
  ));

  select swo.*
  into v_existing
  from lihen_private.sale_write_operations swo
  where swo.operation_key=btrim(p_operation_key);

  if found then
    if v_existing.operation_type <> 'COMPLETE_ORDER_SALE'
       or v_existing.actor_id <> v_actor
       or v_existing.request_fingerprint is distinct from v_fp then
      raise exception using
        errcode='23505',
        message='LIHEN_SALE_OPERATION_CONFLICT';
    end if;

    return query
      select s.id,s.sale_number,s.order_id,s.total_amount,s.status
      from public.sales s
      where s.id=v_existing.sale_id;

    return;
  end if;

  if exists(
    select 1
    from public.sales sx
    where sx.order_id=p_order_id
  ) then
    raise exception using
      errcode='23505',
      message='LIHEN_ORDER_ALREADY_SOLD';
  end if;

  for v_item in
    select oi.*
    from public.order_items oi
    where oi.order_id=p_order_id
    order by oi.product_id,oi.id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(v_item.product_id::text,0)    );

    select ist.*
    into v_balance
    from public.inventory_stock ist
    where ist.product_id=v_item.product_id;

    if coalesce(v_balance.stock_reserved,0) < v_item.quantity
       or coalesce(v_balance.stock_on_hand,0) < v_item.quantity then
      raise exception using
        errcode='22023',
        message='LIHEN_RESERVED_STOCK_INSUFFICIENT';
    end if;

    v_items_subtotal :=
      v_items_subtotal
      + (v_item.quantity * v_item.unit_price);
  end loop;

  if round(coalesce(v_order.subtotal,0)::numeric,2)
     <> round(v_items_subtotal::numeric,2) then
    raise exception using
      errcode='23514',
      message='LIHEN_ORDER_SUBTOTAL_STALE';
  end if;

  if round(coalesce(v_order.total,0)::numeric,2)
     <> round((
       coalesce(v_order.subtotal,0)
       - coalesce(v_order.discount_amount,0)
       + coalesce(v_order.delivery_cost,0)
     )::numeric,2) then
    raise exception using
      errcode='23514',
      message='LIHEN_ORDER_TOTAL_INVALID';
  end if;

  select
    coalesce(sum(a.applied_discount_amount),0)
  into v_applied_discount
  from public.order_customer_benefit_applications a
  where a.order_id=p_order_id
    and a.status='APPLIED';

  if v_applied_discount > 0 then
    if v_order.discount_type <> 'FIXED'
       or round(v_order.discount_value::numeric,2)
          <> round(v_applied_discount::numeric,2)
       or round(v_order.discount_amount::numeric,2)
          <> round(v_applied_discount::numeric,2) then
      raise exception using
        errcode='23514',
        message='LIHEN_CUSTOMER_BENEFIT_ORDER_DISCOUNT_PROVENANCE_MISMATCH';
    end if;
  end if;

  v_total := v_order.total;

  insert into public.sales(
    id,
    sale_number,
    order_id,
    channel,
    status,
    customer_name,
    customer_phone,
    customer_id,
    occurred_at,
    total_amount,
    financial_account_id,
    notes
  )
  values(
    p_sale_id,
    btrim(p_sale_number),
    p_order_id,
    v_order.channel,
    'COMPLETED',
    v_order.customer_name,
    v_order.customer_phone,
    v_order.customer_id,
    coalesce(p_occurred_at,now()),
    v_total,
    p_financial_account_id,
    nullif(btrim(coalesce(p_notes,'')),'')
  );

  for v_item in
    select oi.*
    from public.order_items oi
    where oi.order_id=p_order_id
    order by oi.product_id,oi.id
  loop
    insert into public.sale_items(
      sale_id,
      product_id,
      quantity,
      unit_price
    )
    values(
      p_sale_id,
      v_item.product_id,
      v_item.quantity,
      v_item.unit_price
    );

    insert into public.inventory_movements(
      product_id,
      bucket,
      quantity_delta,
      reason,
      occurred_at,
      external_reference,
      notes
    )
    values(
      v_item.product_id,
      'RESERVED',
      -v_item.quantity,
      'SALE_COMPLETED',
      coalesce(p_occurred_at,now()),
      p_sale_id::text,
      'Liberación de reserva por venta completada'
    );

    insert into public.inventory_movements(
      product_id,
      bucket,
      quantity_delta,
      reason,
      occurred_at,
      external_reference,
      notes
    )
    values(
      v_item.product_id,
      'ON_HAND',
      -v_item.quantity,
      'SALE_COMPLETED',
      coalesce(p_occurred_at,now()),
      p_sale_id::text,
      'Salida física por venta completada'
    );
  end loop;

  -- Atomic Customer Benefit redemption. Any error here aborts the
  -- surrounding sale/inventory/finance/order transaction.
  for v_application in
    select a.*
    from public.order_customer_benefit_applications a
    where a.order_id=p_order_id
      and a.status='APPLIED'
    order by a.business_line,a.id
    for update
  loop
    select *
    into v_redemption
    from public.redeem_customer_benefit_controlled(
      btrim(p_operation_key)
        || ':benefit:'
        || v_application.benefit_id::text,
      v_application.benefit_id,
      p_sale_id
    );

    update public.order_customer_benefit_applications a
    set
      status='REDEEMED',
      updated_at=now(),
      metadata=
        coalesce(a.metadata,'{}'::jsonb)
        ||
        jsonb_build_object(
          'redeemedSaleId',p_sale_id,
          'redeemedAt',clock_timestamp(),
          'atomicWithSaleCompletion',true
        )
    where a.id=v_application.id;
  end loop;

  insert into public.financial_movements(
    id,
    account_id,
    movement_type,
    amount_signed,
    occurred_at,
    description,
    reference_type,
    reference_id
  )
  values(
    v_movement_id,
    p_financial_account_id,
    'SALE_INCOME',
    v_total,
    coalesce(p_occurred_at,now()),
    'Ingreso por venta '||btrim(p_sale_number),
    'SALE',
    p_sale_id
  );

  update public.orders o
  set
    status='COMPLETED',
    payment_status='PAID',
    updated_at=now()
  where o.id=p_order_id;

  insert into lihen_private.sale_write_operations(
    operation_key,
    operation_type,
    actor_id,
    sale_id,
    request_fingerprint,
    result_snapshot
  )
  values(
    btrim(p_operation_key),
    'COMPLETE_ORDER_SALE',
    v_actor,
    p_sale_id,
    v_fp,
    jsonb_build_object(
      'sale_id',p_sale_id,
      'items_subtotal',v_items_subtotal,
      'discount_amount',v_order.discount_amount,
      'customer_benefit_discount',v_applied_discount,
      'delivery_cost',v_order.delivery_cost,
      'total_amount',v_total,
      'financial_movement_id',v_movement_id
    )
  );

  return query
    select s.id,s.sale_number,s.order_id,s.total_amount,s.status
    from public.sales s
    where s.id=p_sale_id;
end;
$function$;

revoke all on function public.complete_order_sale_controlled(text,uuid,text,uuid,uuid,timestamptz,text) from public,anon;
grant execute on function public.complete_order_sale_controlled(text,uuid,text,uuid,uuid,timestamptz,text) to authenticated,service_role;
