-- POS-03: replay idempotente antes del estado vendible.
-- CANDIDATO DEV. No ejecutar sin revisión de dependencias.

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
      'LiberaciÃ³n de reserva por venta completada'
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
      'Salida fÃ­sica por venta completada'
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
