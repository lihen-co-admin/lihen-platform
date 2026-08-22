-- Fix found by transactional dry-run: qualify order_id references inside the RPC.
create or replace function public.complete_order_sale_controlled(
 p_operation_key text,p_sale_id uuid,p_sale_number text,p_order_id uuid,p_financial_account_id uuid,p_occurred_at timestamptz,p_notes text
) returns table(sale_id uuid,sale_number text,order_id uuid,total_amount numeric,status text)
language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid:=auth.uid(); v_fp text; v_existing lihen_private.sale_write_operations%rowtype; v_order public.orders%rowtype; v_total numeric:=0; v_item record; v_balance record; v_movement_id uuid:=gen_random_uuid();
begin
 if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_SALE_FORBIDDEN'; end if;
 if p_operation_key is null or btrim(p_operation_key)='' or p_sale_id is null or p_order_id is null or p_financial_account_id is null or p_sale_number is null or btrim(p_sale_number)='' then raise exception using errcode='22023',message='LIHEN_SALE_FIELDS_REQUIRED'; end if;
 if not exists(select 1 from public.financial_accounts a where a.id=p_financial_account_id and a.status='ACTIVE') then raise exception using errcode='23503',message='LIHEN_FINANCIAL_ACCOUNT_NOT_ACTIVE'; end if;
 select o.* into v_order from public.orders o where o.id=p_order_id for update;
 if not found then raise exception using errcode='P0002',message='LIHEN_ORDER_NOT_FOUND'; end if;
 if v_order.status not in('CONFIRMED','PREPARING','READY') then raise exception using errcode='22023',message='LIHEN_ORDER_NOT_SELLABLE'; end if;
 if not exists(select 1 from public.order_items oi0 where oi0.order_id=p_order_id) then raise exception using errcode='22023',message='LIHEN_ORDER_EMPTY'; end if;
 v_fp:=md5(concat_ws('|',p_sale_id::text,btrim(p_sale_number),p_order_id::text,p_financial_account_id::text,p_occurred_at::text,coalesce(p_notes,'')));
 select swo.* into v_existing from lihen_private.sale_write_operations swo where swo.operation_key=btrim(p_operation_key);
 if found then
   if v_existing.operation_type<>'COMPLETE_ORDER_SALE' or v_existing.actor_id<>v_actor or v_existing.request_fingerprint is distinct from v_fp then raise exception using errcode='23505',message='LIHEN_SALE_OPERATION_CONFLICT'; end if;
   return query select s.id,s.sale_number,s.order_id,s.total_amount,s.status from public.sales s where s.id=v_existing.sale_id;return;
 end if;
 if exists(select 1 from public.sales sx where sx.order_id=p_order_id) then raise exception using errcode='23505',message='LIHEN_ORDER_ALREADY_SOLD'; end if;
 for v_item in select oi.* from public.order_items oi where oi.order_id=p_order_id order by oi.id loop
   select ist.* into v_balance from public.inventory_stock ist where ist.product_id=v_item.product_id;
   if coalesce(v_balance.stock_reserved,0)<v_item.quantity or coalesce(v_balance.stock_on_hand,0)<v_item.quantity then raise exception using errcode='22023',message='LIHEN_RESERVED_STOCK_INSUFFICIENT'; end if;
   v_total:=v_total+(v_item.quantity*v_item.unit_price);
 end loop;
 insert into public.sales(id,sale_number,order_id,channel,status,customer_name,customer_phone,occurred_at,total_amount,financial_account_id,notes)
 values(p_sale_id,btrim(p_sale_number),p_order_id,v_order.channel,'COMPLETED',v_order.customer_name,v_order.customer_phone,coalesce(p_occurred_at,now()),v_total,p_financial_account_id,nullif(btrim(coalesce(p_notes,'')),''));
 for v_item in select oi.* from public.order_items oi where oi.order_id=p_order_id order by oi.id loop
   insert into public.sale_items(sale_id,product_id,quantity,unit_price) values(p_sale_id,v_item.product_id,v_item.quantity,v_item.unit_price);
   insert into public.inventory_movements(product_id,bucket,quantity_delta,reason,occurred_at,external_reference,notes) values(v_item.product_id,'RESERVED',-v_item.quantity,'SALE_COMPLETED',coalesce(p_occurred_at,now()),p_sale_id::text,'Liberación de reserva por venta completada');
   insert into public.inventory_movements(product_id,bucket,quantity_delta,reason,occurred_at,external_reference,notes) values(v_item.product_id,'ON_HAND',-v_item.quantity,'SALE_COMPLETED',coalesce(p_occurred_at,now()),p_sale_id::text,'Salida física por venta completada');
 end loop;
 insert into public.financial_movements(id,account_id,movement_type,amount_signed,occurred_at,description,reference_type,reference_id)
 values(v_movement_id,p_financial_account_id,'SALE_INCOME',v_total,coalesce(p_occurred_at,now()),'Ingreso por venta '||btrim(p_sale_number),'SALE',p_sale_id);
 update public.orders o set status='COMPLETED',updated_at=now() where o.id=p_order_id;
 insert into lihen_private.sale_write_operations(operation_key,operation_type,actor_id,sale_id,request_fingerprint,result_snapshot)
 values(btrim(p_operation_key),'COMPLETE_ORDER_SALE',v_actor,p_sale_id,v_fp,jsonb_build_object('sale_id',p_sale_id,'total_amount',v_total,'financial_movement_id',v_movement_id));
 return query select s.id,s.sale_number,s.order_id,s.total_amount,s.status from public.sales s where s.id=p_sale_id;
end;$fn$;
revoke all on function public.complete_order_sale_controlled(text,uuid,text,uuid,uuid,timestamptz,text) from public,anon;
grant execute on function public.complete_order_sale_controlled(text,uuid,text,uuid,uuid,timestamptz,text) to authenticated,service_role;
