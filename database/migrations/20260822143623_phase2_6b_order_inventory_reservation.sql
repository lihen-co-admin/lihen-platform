-- FASE 2.6B: confirmación/cancelación de pedidos con reserva de inventario.
-- Confirmar: RESERVED += cantidad. Cancelar: RESERVED -= cantidad.
-- No reduce ON_HAND y no mueve caja.
create or replace function public.confirm_order_controlled(
  p_operation_key text,
  p_order_id uuid,
  p_occurred_at timestamptz default now()
)
returns table(id uuid,order_number text,status text,reserved_units bigint)
language plpgsql security definer set search_path=''
as $function$
declare
  v_actor_id uuid:=auth.uid(); v_fingerprint text; v_existing lihen_private.order_write_operations%rowtype; v_order public.orders%rowtype; v_item public.order_items%rowtype; v_available bigint; v_total bigint:=0;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_ORDER_CONFIRM_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_order_id is null or p_occurred_at is null then raise exception using errcode='22023',message='LIHEN_ORDER_CONFIRM_INPUT_REQUIRED'; end if;
  v_fingerprint:=md5(concat_ws('|',p_order_id::text,p_occurred_at::text));
  select o.* into v_existing from lihen_private.order_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'CONFIRM_ORDER' or v_existing.actor_id<>v_actor_id or v_existing.order_id<>p_order_id or v_existing.request_fingerprint is distinct from v_fingerprint or v_existing.result_snapshot is null then raise exception using errcode='23505',message='LIHEN_ORDER_WRITE_OPERATION_CONFLICT'; end if;
    return query select (v_existing.result_snapshot->>'id')::uuid,v_existing.result_snapshot->>'order_number',v_existing.result_snapshot->>'status',(v_existing.result_snapshot->>'reserved_units')::bigint;return;
  end if;
  select * into v_order from public.orders where orders.id=p_order_id for update;
  if not found then raise exception using errcode='P0002',message='LIHEN_ORDER_NOT_FOUND'; end if;
  if v_order.status<>'DRAFT' then raise exception using errcode='22023',message='LIHEN_ORDER_CONFIRM_REQUIRES_DRAFT'; end if;
  if not exists(select 1 from public.order_items i where i.order_id=p_order_id) then raise exception using errcode='22023',message='LIHEN_ORDER_ITEMS_REQUIRED'; end if;
  for v_item in select * from public.order_items i where i.order_id=p_order_id order by i.product_id loop
    perform pg_advisory_xact_lock(hashtextextended(v_item.product_id::text,0));
    select stock_available into v_available from public.inventory_stock where product_id=v_item.product_id;
    if coalesce(v_available,0) < v_item.quantity then raise exception using errcode='22023',message='LIHEN_INSUFFICIENT_AVAILABLE_STOCK'; end if;
  end loop;
  for v_item in select * from public.order_items i where i.order_id=p_order_id order by i.product_id loop
    insert into public.inventory_movements(product_id,bucket,quantity_delta,reason,occurred_at,external_reference,notes)
    values(v_item.product_id,'RESERVED',v_item.quantity,'ORDER_CONFIRMED',p_occurred_at,v_order.order_number,'Reserva de inventario por pedido confirmado.');
    v_total:=v_total+v_item.quantity;
  end loop;
  update public.orders set status='CONFIRMED',updated_at=now() where orders.id=p_order_id returning * into v_order;
  insert into lihen_private.order_write_operations(operation_key,operation_type,actor_id,order_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'CONFIRM_ORDER',v_actor_id,p_order_id,v_fingerprint,jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'status',v_order.status,'reserved_units',v_total));
  return query select v_order.id,v_order.order_number,v_order.status,v_total;
end;$function$;

create or replace function public.cancel_order_controlled(
  p_operation_key text,
  p_order_id uuid,
  p_occurred_at timestamptz default now(),
  p_reason text default null
)
returns table(id uuid,order_number text,status text,released_units bigint)
language plpgsql security definer set search_path=''
as $function$
declare
  v_actor_id uuid:=auth.uid();v_fingerprint text;v_existing lihen_private.order_write_operations%rowtype;v_order public.orders%rowtype;v_item public.order_items%rowtype;v_total bigint:=0;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_ORDER_CANCEL_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_order_id is null or p_occurred_at is null then raise exception using errcode='22023',message='LIHEN_ORDER_CANCEL_INPUT_REQUIRED'; end if;
  v_fingerprint:=md5(concat_ws('|',p_order_id::text,p_occurred_at::text,coalesce(p_reason,'')));
  select o.* into v_existing from lihen_private.order_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'CANCEL_ORDER' or v_existing.actor_id<>v_actor_id or v_existing.order_id<>p_order_id or v_existing.request_fingerprint is distinct from v_fingerprint or v_existing.result_snapshot is null then raise exception using errcode='23505',message='LIHEN_ORDER_WRITE_OPERATION_CONFLICT'; end if;
    return query select (v_existing.result_snapshot->>'id')::uuid,v_existing.result_snapshot->>'order_number',v_existing.result_snapshot->>'status',(v_existing.result_snapshot->>'released_units')::bigint;return;
  end if;
  select * into v_order from public.orders where orders.id=p_order_id for update;
  if not found then raise exception using errcode='P0002',message='LIHEN_ORDER_NOT_FOUND'; end if;
  if v_order.status in('COMPLETED','CANCELLED') then raise exception using errcode='22023',message='LIHEN_ORDER_CANNOT_CANCEL'; end if;
  if v_order.status in('CONFIRMED','PREPARING','READY') then
    for v_item in select * from public.order_items i where i.order_id=p_order_id order by i.product_id loop
      insert into public.inventory_movements(product_id,bucket,quantity_delta,reason,occurred_at,external_reference,notes)
      values(v_item.product_id,'RESERVED',-v_item.quantity,'ORDER_CANCELLED',p_occurred_at,v_order.order_number,coalesce(nullif(btrim(coalesce(p_reason,'')),''),'Reserva liberada por cancelación.'));
      v_total:=v_total+v_item.quantity;
    end loop;
  end if;
  update public.orders set status='CANCELLED',notes=case when p_reason is null or btrim(p_reason)='' then notes else concat_ws(E'\n',notes,'Cancelación: '||btrim(p_reason)) end,updated_at=now() where orders.id=p_order_id returning * into v_order;
  insert into lihen_private.order_write_operations(operation_key,operation_type,actor_id,order_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'CANCEL_ORDER',v_actor_id,p_order_id,v_fingerprint,jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'status',v_order.status,'released_units',v_total));
  return query select v_order.id,v_order.order_number,v_order.status,v_total;
end;$function$;
revoke all on function public.confirm_order_controlled(text,uuid,timestamptz) from public,anon;
revoke all on function public.cancel_order_controlled(text,uuid,timestamptz,text) from public,anon;
grant execute on function public.confirm_order_controlled(text,uuid,timestamptz) to authenticated;
grant execute on function public.cancel_order_controlled(text,uuid,timestamptz,text) to authenticated;
