-- FASE 1.21.5 — Approved Product Import Cutover Foundation
-- Installs slug-aware product writes and a controlled batch importer.
-- All write functions remain revoked from anon/authenticated after deployment.

drop function if exists public.create_product_controlled(text,uuid,text,text,text,text,uuid,uuid,text,numeric);
drop function if exists public.update_product_controlled(text,uuid,text,text,text,text,uuid,uuid,text);

create function public.create_product_controlled(
  p_operation_key text,p_id uuid,p_sku text,p_catalog_code text,p_slug text,p_name text,
  p_business_line text,p_brand_id uuid,p_category_id uuid,p_status text,p_sale_price numeric
)
returns table(id uuid,sku text,catalog_code text,slug text,name text,business_line text,brand_id uuid,category_id uuid,status text,sale_price numeric)
language plpgsql security definer set search_path=''
as $$
declare v_actor_id uuid:=auth.uid(); v_existing_product_id uuid;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PRODUCT_CREATE_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_id is null then raise exception using errcode='22023',message='LIHEN_PRODUCT_ID_REQUIRED'; end if;
  if p_name is null or length(btrim(p_name))=0 then raise exception using errcode='22023',message='LIHEN_PRODUCT_NAME_REQUIRED'; end if;
  if p_slug is null or length(btrim(p_slug))=0 then raise exception using errcode='22023',message='LIHEN_PRODUCT_SLUG_REQUIRED'; end if;
  if p_sale_price is null or p_sale_price<0 then raise exception using errcode='22023',message='LIHEN_PRODUCT_PRICE_INVALID'; end if;
  if p_status not in('ACTIVE','INACTIVE','DISCONTINUED','ARCHIVED') then raise exception using errcode='22023',message='LIHEN_PRODUCT_STATUS_INVALID'; end if;
  perform lihen_private.assert_product_category_business_line(p_business_line,p_category_id);
  if p_brand_id is not null and not exists(select 1 from public.brands b where b.id=p_brand_id) then raise exception using errcode='23503',message='LIHEN_BRAND_NOT_FOUND'; end if;
  select o.product_id into v_existing_product_id from lihen_private.product_write_operations o where o.operation_key=btrim(p_operation_key) and o.operation_type='CREATE_PRODUCT' and o.actor_id=v_actor_id;
  if v_existing_product_id is not null then
    return query select pr.id,pr.sku,pr.catalog_code,pr.slug,pr.name,pr.business_line,pr.brand_id,pr.category_id,pr.status,pr.sale_price from public.products pr where pr.id=v_existing_product_id;
    return;
  end if;
  insert into public.products(id,sku,catalog_code,slug,name,business_line,brand_id,category_id,status,sale_price)
  values(p_id,nullif(btrim(p_sku),''),nullif(btrim(p_catalog_code),''),btrim(p_slug),btrim(p_name),p_business_line,p_brand_id,p_category_id,p_status,p_sale_price);
  insert into lihen_private.product_write_operations(operation_key,operation_type,actor_id,product_id)
  values(btrim(p_operation_key),'CREATE_PRODUCT',v_actor_id,p_id);
  return query select pr.id,pr.sku,pr.catalog_code,pr.slug,pr.name,pr.business_line,pr.brand_id,pr.category_id,pr.status,pr.sale_price from public.products pr where pr.id=p_id;
end;
$$;

create function public.update_product_controlled(
  p_operation_key text,p_product_id uuid,p_sku text,p_catalog_code text,p_slug text,p_name text,
  p_business_line text,p_brand_id uuid,p_category_id uuid,p_status text
)
returns table(id uuid,sku text,catalog_code text,slug text,name text,business_line text,brand_id uuid,category_id uuid,status text,sale_price numeric)
language plpgsql security definer set search_path=''
as $$
declare v_actor_id uuid:=auth.uid(); v_fingerprint text; v_existing lihen_private.product_write_operations%rowtype; v_result public.products%rowtype;
begin
  if v_actor_id is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor_id and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_PRODUCT_UPDATE_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  if p_product_id is null then raise exception using errcode='22023',message='LIHEN_PRODUCT_ID_REQUIRED'; end if;
  if p_name is null or length(btrim(p_name))=0 then raise exception using errcode='22023',message='LIHEN_PRODUCT_NAME_REQUIRED'; end if;
  if p_slug is null or length(btrim(p_slug))=0 then raise exception using errcode='22023',message='LIHEN_PRODUCT_SLUG_REQUIRED'; end if;
  if p_status not in('ACTIVE','INACTIVE','DISCONTINUED','ARCHIVED') then raise exception using errcode='22023',message='LIHEN_PRODUCT_STATUS_INVALID'; end if;
  perform lihen_private.assert_product_category_business_line(p_business_line,p_category_id);
  if p_brand_id is not null and not exists(select 1 from public.brands b where b.id=p_brand_id) then raise exception using errcode='23503',message='LIHEN_BRAND_NOT_FOUND'; end if;
  v_fingerprint:=md5(concat_ws('|',p_product_id::text,coalesce(nullif(btrim(p_sku),''),'<NULL>'),coalesce(nullif(btrim(p_catalog_code),''),'<NULL>'),btrim(p_slug),btrim(p_name),p_business_line,coalesce(p_brand_id::text,'<NULL>'),coalesce(p_category_id::text,'<NULL>'),p_status));
  select o.* into v_existing from lihen_private.product_write_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.operation_type<>'UPDATE_PRODUCT' or v_existing.actor_id<>v_actor_id or v_existing.product_id<>p_product_id or v_existing.request_fingerprint is distinct from v_fingerprint or v_existing.result_snapshot is null then raise exception using errcode='23505',message='LIHEN_PRODUCT_WRITE_OPERATION_CONFLICT'; end if;
    return query select (v_existing.result_snapshot->>'id')::uuid,nullif(v_existing.result_snapshot->>'sku',''),nullif(v_existing.result_snapshot->>'catalog_code',''),v_existing.result_snapshot->>'slug',v_existing.result_snapshot->>'name',v_existing.result_snapshot->>'business_line',nullif(v_existing.result_snapshot->>'brand_id','')::uuid,nullif(v_existing.result_snapshot->>'category_id','')::uuid,v_existing.result_snapshot->>'status',(v_existing.result_snapshot->>'sale_price')::numeric;
    return;
  end if;
  if not exists(select 1 from public.products p where p.id=p_product_id) then raise exception using errcode='P0002',message='LIHEN_PRODUCT_NOT_FOUND'; end if;
  update public.products p set sku=nullif(btrim(p_sku),''),catalog_code=nullif(btrim(p_catalog_code),''),slug=btrim(p_slug),name=btrim(p_name),business_line=p_business_line,brand_id=p_brand_id,category_id=p_category_id,status=p_status,updated_at=now() where p.id=p_product_id returning p.* into v_result;
  insert into lihen_private.product_write_operations(operation_key,operation_type,actor_id,product_id,request_fingerprint,result_snapshot)
  values(btrim(p_operation_key),'UPDATE_PRODUCT',v_actor_id,p_product_id,v_fingerprint,jsonb_build_object('id',v_result.id,'sku',v_result.sku,'catalog_code',v_result.catalog_code,'slug',v_result.slug,'name',v_result.name,'business_line',v_result.business_line,'brand_id',v_result.brand_id,'category_id',v_result.category_id,'status',v_result.status,'sale_price',v_result.sale_price));
  return query select v_result.id,v_result.sku,v_result.catalog_code,v_result.slug,v_result.name,v_result.business_line,v_result.brand_id,v_result.category_id,v_result.status,v_result.sale_price;
end;
$$;

create or replace function public.import_approved_products_controlled(p_operation_key text,p_import_run_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid(); v_run lihen_private.approved_product_import_runs%rowtype;
  v_existing lihen_private.approved_product_import_operations%rowtype;
  v_total integer; v_ready integer; v_conflicts integer; v_created integer:=0;
  v_fingerprint text; v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.authorization_status='ACTIVE' and p.role_code in('OWNER','ADMIN')) then raise exception using errcode='42501',message='LIHEN_APPROVED_PRODUCT_IMPORT_FORBIDDEN'; end if;
  if p_operation_key is null or length(btrim(p_operation_key))=0 then raise exception using errcode='22023',message='LIHEN_OPERATION_KEY_REQUIRED'; end if;
  select * into v_run from lihen_private.approved_product_import_runs r where r.id=p_import_run_id and r.status='COMPLETED';
  if not found then raise exception using errcode='22023',message='LIHEN_APPROVED_PRODUCT_IMPORT_RUN_NOT_COMPLETED'; end if;
  if v_run.scope<>'HUMAN_APPROVED_IMPORT_SUBSET' then raise exception using errcode='22023',message='LIHEN_APPROVED_PRODUCT_IMPORT_SCOPE_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('LIHEN_APPROVED_PRODUCT_IMPORT',0));
  select count(*),count(*) filter(where p.import_status='READY_CREATE'),count(*) filter(where p.import_status<>'READY_CREATE') into v_total,v_ready,v_conflicts from lihen_private.preview_approved_product_import(p_import_run_id) p;
  if v_total<>v_run.approved_source_count or v_ready<>v_total or v_conflicts<>0 then raise exception using errcode='23505',message='LIHEN_APPROVED_PRODUCT_IMPORT_PREVIEW_NOT_READY'; end if;
  v_fingerprint:=md5(concat_ws('|',p_import_run_id::text,v_total::text,v_ready::text,v_run.strategy_version));
  select * into v_existing from lihen_private.approved_product_import_operations o where o.operation_key=btrim(p_operation_key);
  if found then
    if v_existing.actor_id<>v_actor or v_existing.import_run_id<>p_import_run_id or v_existing.request_fingerprint<>v_fingerprint then raise exception using errcode='23505',message='LIHEN_APPROVED_PRODUCT_IMPORT_OPERATION_CONFLICT'; end if;
    return v_existing.result_snapshot;
  end if;
  insert into public.products(id,sku,catalog_code,slug,name,business_line,brand,category,description,sale_price,current_cost,minimum_stock,status,visible_on_website,main_image_url,brand_id,category_id)
  select a.proposed_product_id,a.proposed_sku,a.proposed_catalog_code,a.proposed_slug,a.product_name,a.business_line,b.name,cat.name,null,a.sale_price,null,0,'ACTIVE',false,null,a.brand_id,a.category_id
  from lihen_private.approved_product_import_candidates a
  left join public.brands b on b.id=a.brand_id
  left join public.categories cat on cat.id=a.category_id and cat.business_line=a.business_line
  where a.import_run_id=p_import_run_id and a.eligibility_status='READY_CREATE';
  get diagnostics v_created=row_count;
  if v_created<>v_total then raise exception using errcode='P0001',message='LIHEN_APPROVED_PRODUCT_IMPORT_CREATE_COUNT_MISMATCH'; end if;
  v_result:=jsonb_build_object('import_run_id',p_import_run_id,'scope',v_run.scope,'business_line',v_run.business_line,'created_products',v_created,'completed_at',now());
  insert into lihen_private.approved_product_import_operations(operation_key,actor_id,import_run_id,request_fingerprint,status,result_snapshot,completed_at)
  values(btrim(p_operation_key),v_actor,p_import_run_id,v_fingerprint,'COMPLETED',v_result,now());
  return v_result;
end;
$$;

revoke all on function public.create_product_controlled(text,uuid,text,text,text,text,text,uuid,uuid,text,numeric) from public,anon,authenticated;
revoke all on function public.update_product_controlled(text,uuid,text,text,text,text,text,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.import_approved_products_controlled(text,uuid) from public,anon,authenticated;
