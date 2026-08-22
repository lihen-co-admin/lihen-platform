-- FASE 2.7A: completed sales/POS. A sale atomically changes inventory and finance.
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),sale_number text not null unique check(length(btrim(sale_number))>0),
  order_id uuid null unique references public.orders(id) on delete restrict,
  channel text not null check(channel in ('WHATSAPP','INSTAGRAM','FACEBOOK','TIKTOK','WEB','IN_PERSON','OTHER')),
  status text not null default 'COMPLETED' check(status in ('COMPLETED','REVERSED')),
  customer_name text null,customer_phone text null,occurred_at timestamptz not null,total_amount numeric(14,2) not null check(total_amount>=0),
  currency text not null default 'COP' check(currency='COP'),financial_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  notes text null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),sale_id uuid not null references public.sales(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,quantity integer not null check(quantity>0),
  unit_price numeric(14,2) not null check(unit_price>=0),created_at timestamptz not null default now(),unique(sale_id,product_id)
);
create table if not exists lihen_private.sale_write_operations (
  operation_key text primary key,operation_type text not null,actor_id uuid not null,sale_id uuid not null,
  request_fingerprint text not null,result_snapshot jsonb null,created_at timestamptz not null default now()
);
alter table public.sales enable row level security;alter table public.sale_items enable row level security;
create policy sales_admin_read on public.sales for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')));
create policy sale_items_admin_read on public.sale_items for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')));
revoke all on public.sales,public.sale_items from anon,authenticated;grant select on public.sales,public.sale_items to authenticated;

-- NOTE: complete_order_sale_controlled is replaced by the following fix migration.
-- The original live migration exposed the same contract but had one ambiguous SQL reference.

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
   select * into v_balance from public.inventory_stock where product_id=v_pid;if coalesce(v_balance.stock_available,0)<v_qty then raise exception using errcode='22023',message='LIHEN_STOCK_INSUFFICIENT'; end if;
   insert into pg_temp.lihen_pos_lines values(v_item_id,v_pid,v_qty,v_price);v_total:=v_total+(v_qty*v_price);
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
