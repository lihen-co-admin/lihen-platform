-- FASE 2.5B — Controlled purchase draft creation.
-- A DRAFT has no inventory or finance side effects. Receiving and payment are separate later gates.

create table if not exists lihen_private.purchase_write_operations (
  operation_key text primary key,
  operation_type text not null,
  actor_id uuid not null,
  purchase_id uuid not null,
  request_fingerprint text not null,
  result_snapshot jsonb,
  created_at timestamptz not null default now()
);
revoke all on lihen_private.purchase_write_operations from public, anon, authenticated;
grant all on lihen_private.purchase_write_operations to service_role;

create or replace function public.create_purchase_draft_controlled(
  p_operation_key text,
  p_purchase_id uuid,
  p_purchase_number text,
  p_supplier_id uuid,
  p_purchase_date date,
  p_expected_date date,
  p_notes text,
  p_items jsonb
)
returns table(id uuid, purchase_number text, supplier_id uuid, status text, purchase_date date, expected_date date, notes text, item_count integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_number text := btrim(coalesce(p_purchase_number,''));
  v_items jsonb := coalesce(p_items,'[]'::jsonb);
  v_fingerprint text;
  v_existing lihen_private.purchase_write_operations%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_cost numeric;
  v_item_id uuid;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PURCHASE_CREATE_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_purchase_id is null then raise exception using errcode='22023',message='LIHEN_PURCHASE_ID_REQUIRED'; end if;
  if length(v_number)=0 then raise exception using errcode='22023',message='LIHEN_PURCHASE_NUMBER_REQUIRED'; end if;
  if p_supplier_id is null or not exists(select 1 from public.suppliers s where s.id=p_supplier_id and s.status='ACTIVE') then raise exception using errcode='23503',message='LIHEN_ACTIVE_SUPPLIER_REQUIRED'; end if;
  if jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception using errcode='22023',message='LIHEN_PURCHASE_ITEMS_REQUIRED'; end if;
  if p_expected_date is not null and p_purchase_date is not null and p_expected_date < p_purchase_date then raise exception using errcode='22023',message='LIHEN_PURCHASE_EXPECTED_DATE_INVALID'; end if;

  v_fingerprint := md5(concat_ws('|',p_purchase_id::text,v_number,p_supplier_id::text,coalesce(p_purchase_date::text,'<NULL>'),coalesce(p_expected_date::text,'<NULL>'),coalesce(nullif(btrim(p_notes),''),'<NULL>'),v_items::text));
  select o.* into v_existing from lihen_private.purchase_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'CREATE_PURCHASE_DRAFT' or v_existing.actor_id<>v_actor_id or v_existing.purchase_id<>p_purchase_id or v_existing.request_fingerprint is distinct from v_fingerprint or v_existing.result_snapshot is null then raise exception using errcode='23505',message='LIHEN_PURCHASE_WRITE_OPERATION_CONFLICT'; end if;
    return query select (v_existing.result_snapshot->>'id')::uuid,v_existing.result_snapshot->>'purchase_number',(v_existing.result_snapshot->>'supplier_id')::uuid,v_existing.result_snapshot->>'status',nullif(v_existing.result_snapshot->>'purchase_date','')::date,nullif(v_existing.result_snapshot->>'expected_date','')::date,nullif(v_existing.result_snapshot->>'notes',''),(v_existing.result_snapshot->>'item_count')::integer;
    return;
  end if;

  if exists(select 1 from public.purchases p where p.id=p_purchase_id or p.purchase_number=v_number) then raise exception using errcode='23505',message='LIHEN_PURCHASE_ALREADY_EXISTS'; end if;

  for v_item in select value from jsonb_array_elements(v_items) loop
    begin v_product_id := (v_item->>'product_id')::uuid; exception when others then raise exception using errcode='22023',message='LIHEN_PURCHASE_PRODUCT_ID_INVALID'; end;
    begin v_qty := (v_item->>'quantity_requested')::integer; exception when others then raise exception using errcode='22023',message='LIHEN_PURCHASE_QUANTITY_INVALID'; end;
    if v_qty <= 0 then raise exception using errcode='22023',message='LIHEN_PURCHASE_QUANTITY_INVALID'; end if;
    if not exists(select 1 from public.products p where p.id=v_product_id) then raise exception using errcode='23503',message='LIHEN_PURCHASE_PRODUCT_NOT_FOUND'; end if;
    if v_item ? 'quoted_unit_cost' and v_item->>'quoted_unit_cost' is not null then
      begin v_cost := (v_item->>'quoted_unit_cost')::numeric; exception when others then raise exception using errcode='22023',message='LIHEN_PURCHASE_COST_INVALID'; end;
      if v_cost < 0 then raise exception using errcode='22023',message='LIHEN_PURCHASE_COST_INVALID'; end if;
    end if;
  end loop;

  if (select count(*) from (select (value->>'product_id') from jsonb_array_elements(v_items) group by 1 having count(*)>1) d)>0 then raise exception using errcode='22023',message='LIHEN_PURCHASE_DUPLICATE_PRODUCT'; end if;

  insert into public.purchases(id,purchase_number,supplier_id,status,purchase_date,expected_date,notes,is_historical)
  values(p_purchase_id,v_number,p_supplier_id,'DRAFT',p_purchase_date,p_expected_date,nullif(btrim(p_notes),''),false);

  for v_item in select value from jsonb_array_elements(v_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity_requested')::integer;
    v_cost := case when v_item ? 'quoted_unit_cost' and v_item->>'quoted_unit_cost' is not null then (v_item->>'quoted_unit_cost')::numeric else null end;
    v_item_id := coalesce(nullif(v_item->>'id','')::uuid,gen_random_uuid());
    insert into public.purchase_items(id,purchase_id,product_id,quantity_requested,quantity_received,quoted_unit_cost,final_unit_cost)
    values(v_item_id,p_purchase_id,v_product_id,v_qty,0,v_cost,null);
  end loop;

  insert into lihen_private.purchase_write_operations(operation_key,operation_type,actor_id,purchase_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'CREATE_PURCHASE_DRAFT',v_actor_id,p_purchase_id,v_fingerprint,jsonb_build_object('id',p_purchase_id,'purchase_number',v_number,'supplier_id',p_supplier_id,'status','DRAFT','purchase_date',coalesce(p_purchase_date::text,''),'expected_date',coalesce(p_expected_date::text,''),'notes',coalesce(nullif(btrim(p_notes),''),''),'item_count',jsonb_array_length(v_items)));

  return query select p_purchase_id,v_number,p_supplier_id,'DRAFT'::text,p_purchase_date,p_expected_date,nullif(btrim(p_notes),''),jsonb_array_length(v_items);
end;
$$;

revoke all on function public.create_purchase_draft_controlled(text,uuid,text,uuid,date,date,text,jsonb) from public,anon;
grant execute on function public.create_purchase_draft_controlled(text,uuid,text,uuid,date,date,text,jsonb) to authenticated;

comment on function public.create_purchase_draft_controlled(text,uuid,text,uuid,date,date,text,jsonb) is 'FASE 2.5B creates a purchase DRAFT atomically. No stock, price, invoice or finance side effects.';
