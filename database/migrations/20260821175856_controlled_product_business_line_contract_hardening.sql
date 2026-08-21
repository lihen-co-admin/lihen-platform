-- Replace CreateProduct contract: business_line is mandatory and returned.
drop function if exists public.create_product_controlled(text,uuid,text,text,text,uuid,uuid,text,numeric);
create function public.create_product_controlled(
  p_operation_key text,
  p_id uuid,
  p_sku text,
  p_catalog_code text,
  p_name text,
  p_business_line text,
  p_brand_id uuid,
  p_category_id uuid,
  p_status text,
  p_sale_price numeric
)
returns table(id uuid,sku text,catalog_code text,name text,business_line text,brand_id uuid,category_id uuid,status text,sale_price numeric)
language plpgsql security definer set search_path=''
as $$
declare v_actor_id uuid:=auth.uid(); v_existing_product_id uuid;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PRODUCT_CREATE_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_id is null then raise exception using errcode='22023',message='LIHEN_PRODUCT_ID_REQUIRED'; end if;
  if p_name is null or length(btrim(p_name))=0 then raise exception using errcode='22023',message='LIHEN_PRODUCT_NAME_REQUIRED'; end if;
  if p_sale_price is null or p_sale_price<0 then raise exception using errcode='22023',message='LIHEN_PRODUCT_PRICE_INVALID'; end if;
  if p_status not in ('ACTIVE','INACTIVE','DISCONTINUED','ARCHIVED') then raise exception using errcode='22023',message='LIHEN_PRODUCT_STATUS_INVALID'; end if;
  perform lihen_private.assert_product_category_business_line(p_business_line,p_category_id);
  if p_brand_id is not null and not exists(select 1 from public.brands b where b.id=p_brand_id) then raise exception using errcode='23503',message='LIHEN_BRAND_NOT_FOUND'; end if;

  select o.product_id into v_existing_product_id from lihen_private.product_write_operations o where o.operation_key=btrim(p_operation_key) and o.operation_type='CREATE_PRODUCT' and o.actor_id=v_actor_id;
  if v_existing_product_id is not null then
    return query select pr.id,pr.sku,pr.catalog_code,pr.name,pr.business_line,pr.brand_id,pr.category_id,pr.status,pr.sale_price from public.products pr where pr.id=v_existing_product_id;
    return;
  end if;

  insert into public.products(id,sku,catalog_code,name,business_line,brand_id,category_id,status,sale_price)
  values(p_id,nullif(btrim(p_sku),''),nullif(btrim(p_catalog_code),''),btrim(p_name),p_business_line,p_brand_id,p_category_id,p_status,p_sale_price);
  insert into lihen_private.product_write_operations(operation_key,operation_type,actor_id,product_id) values(btrim(p_operation_key),'CREATE_PRODUCT',v_actor_id,p_id);
  return query select pr.id,pr.sku,pr.catalog_code,pr.name,pr.business_line,pr.brand_id,pr.category_id,pr.status,pr.sale_price from public.products pr where pr.id=p_id;
end;
$$;
revoke execute on function public.create_product_controlled(text,uuid,text,text,text,text,uuid,uuid,text,numeric) from public,anon,authenticated;

-- Replace UpdateProduct contract: line can be changed only explicitly and category must match it.
drop function if exists public.update_product_controlled(text,uuid,text,text,text,uuid,uuid,text);
create function public.update_product_controlled(
  p_operation_key text,
  p_product_id uuid,
  p_sku text,
  p_catalog_code text,
  p_name text,
  p_business_line text,
  p_brand_id uuid,
  p_category_id uuid,
  p_status text
)
returns table(id uuid,sku text,catalog_code text,name text,business_line text,brand_id uuid,category_id uuid,status text,sale_price numeric)
language plpgsql security definer set search_path=''
as $$
declare v_actor_id uuid:=auth.uid(); v_fingerprint text; v_existing lihen_private.product_write_operations%rowtype; v_result public.products%rowtype;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in ('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PRODUCT_UPDATE_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_product_id is null then raise exception using errcode='22023',message='LIHEN_PRODUCT_ID_REQUIRED'; end if;
  if p_name is null or length(btrim(p_name))=0 then raise exception using errcode='22023',message='LIHEN_PRODUCT_NAME_REQUIRED'; end if;
  if p_status not in ('ACTIVE','INACTIVE','DISCONTINUED','ARCHIVED') then raise exception using errcode='22023',message='LIHEN_PRODUCT_STATUS_INVALID'; end if;
  perform lihen_private.assert_product_category_business_line(p_business_line,p_category_id);
  if p_brand_id is not null and not exists(select 1 from public.brands b where b.id=p_brand_id) then raise exception using errcode='23503',message='LIHEN_BRAND_NOT_FOUND'; end if;

  v_fingerprint:=md5(concat_ws('|',p_product_id::text,coalesce(nullif(btrim(p_sku),''),'<NULL>'),coalesce(nullif(btrim(p_catalog_code),''),'<NULL>'),btrim(p_name),p_business_line,coalesce(p_brand_id::text,'<NULL>'),coalesce(p_category_id::text,'<NULL>'),p_status));
  select o.* into v_existing from lihen_private.product_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'UPDATE_PRODUCT' or v_existing.actor_id<>v_actor_id or v_existing.product_id<>p_product_id or v_existing.request_fingerprint is distinct from v_fingerprint or v_existing.result_snapshot is null then raise exception using errcode='23505',message='LIHEN_PRODUCT_WRITE_OPERATION_CONFLICT'; end if;
    return query select (v_existing.result_snapshot->>'id')::uuid,nullif(v_existing.result_snapshot->>'sku',''),nullif(v_existing.result_snapshot->>'catalog_code',''),v_existing.result_snapshot->>'name',v_existing.result_snapshot->>'business_line',nullif(v_existing.result_snapshot->>'brand_id','')::uuid,nullif(v_existing.result_snapshot->>'category_id','')::uuid,v_existing.result_snapshot->>'status',(v_existing.result_snapshot->>'sale_price')::numeric;
    return;
  end if;
  if not exists(select 1 from public.products p where p.id=p_product_id) then raise exception using errcode='P0002',message='LIHEN_PRODUCT_NOT_FOUND'; end if;

  update public.products p set sku=nullif(btrim(p_sku),''),catalog_code=nullif(btrim(p_catalog_code),''),name=btrim(p_name),business_line=p_business_line,brand_id=p_brand_id,category_id=p_category_id,status=p_status,updated_at=now() where p.id=p_product_id returning p.* into v_result;
  insert into lihen_private.product_write_operations(operation_key,operation_type,actor_id,product_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'UPDATE_PRODUCT',v_actor_id,p_product_id,v_fingerprint,jsonb_build_object('id',v_result.id,'sku',v_result.sku,'catalog_code',v_result.catalog_code,'name',v_result.name,'business_line',v_result.business_line,'brand_id',v_result.brand_id,'category_id',v_result.category_id,'status',v_result.status,'sale_price',v_result.sale_price));
  return query select v_result.id,v_result.sku,v_result.catalog_code,v_result.name,v_result.business_line,v_result.brand_id,v_result.category_id,v_result.status,v_result.sale_price;
end;
$$;
revoke execute on function public.update_product_controlled(text,uuid,text,text,text,text,uuid,uuid,text) from public,anon,authenticated;

