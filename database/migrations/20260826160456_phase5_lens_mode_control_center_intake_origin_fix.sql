create or replace function lihen_private.start_visual_intelligence_session(p_product_id uuid,p_input_asset_reference text,p_input_origin text default 'USER_PROVIDED') returns uuid
language plpgsql security definer set search_path=public,lihen_private as $function$
declare v_session_id uuid; v_sku text; v_name text; v_origin text;
begin
  select sku,name into v_sku,v_name from public.products where id=p_product_id;
  if not found then raise exception 'Unknown product_id %',p_product_id; end if;
  v_origin:=case upper(coalesce(p_input_origin,'')) when 'USER_PROVIDED' then 'USER_PROVIDED' when 'CONTROL_CENTER_UPLOAD' then 'USER_PROVIDED' when 'CONTROL_CENTER_REGRESSION_TEST' then 'INTERNAL_LIHEN' when 'INTERNAL_LIHEN' then 'INTERNAL_LIHEN' when 'SUPPLIER_PROVIDED' then 'SUPPLIER_PROVIDED' when 'CATALOG_EVIDENCE' then 'CATALOG_EVIDENCE' else 'USER_PROVIDED' end;
  insert into lihen_private.visual_intelligence_sessions(product_id,sku_snapshot,product_name_snapshot,input_type,input_asset_reference,input_origin,workflow_mode,status,requires_human_review,summary)
  values(p_product_id,v_sku,v_name,'IMAGE',p_input_asset_reference,v_origin,'LENS_MODE','RECEIVED',true,'Lens Mode intake created from Control Center image attachment. No Product Master mutation or publication is allowed from intake alone.')
  returning id into v_session_id;
  return v_session_id;
end;$function$;
