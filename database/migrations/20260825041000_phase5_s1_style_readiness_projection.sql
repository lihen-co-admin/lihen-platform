create or replace function public.get_style_product_readiness_controlled()
returns table(product_id uuid,sku text,product_name text,visible_on_website boolean,brand_id uuid,category_id uuid,sale_price numeric,available_stock bigint,exact_approved_image_count bigint,readiness text,blocking_reasons text[])
language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception using errcode='42501',message='LIHEN_AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles pr where pr.id=v_actor and pr.authorization_status='ACTIVE' and pr.role_code in('OWNER','ADMIN','OPERATOR','VIEWER')) then raise exception using errcode='42501',message='LIHEN_STYLE_READ_FORBIDDEN'; end if;
  return query
  select p.id,p.sku,p.name,p.visible_on_website,p.brand_id,p.category_id,p.sale_price,coalesce(s.stock_available,0),
    coalesce(img.exact_count,0),
    case when p.status='ACTIVE' and nullif(btrim(p.sku),'') is not null and p.sale_price is not null and p.sale_price>=0 and p.brand_id is not null and p.category_id is not null and coalesce(img.exact_count,0)>0 and p.visible_on_website=false then 'READY' else 'BLOCKED' end,
    array_remove(array[
      case when p.status<>'ACTIVE' then 'PRODUCT_NOT_ACTIVE' end,
      case when nullif(btrim(p.sku),'') is null then 'SKU_REQUIRED' end,
      case when p.sale_price is null or p.sale_price<0 then 'SALE_PRICE_REQUIRED' end,
      case when p.brand_id is null then 'BRAND_REQUIRED' end,
      case when p.category_id is null then 'CATEGORY_REQUIRED' end,
      case when coalesce(img.exact_count,0)=0 then 'EXACT_APPROVED_IMAGE_REQUIRED' end,
      case when p.visible_on_website then 'PREMATURE_VISIBILITY' end
    ],null)::text[]
  from public.products p
  left join public.inventory_stock s on s.product_id=p.id
  left join lateral(
    select count(*)::bigint exact_count
    from public.product_images pi
    join lihen_private.product_image_sources src on src.id=pi.source_id
    where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>'' and src.is_exact_product_match=true and src.review_status='HUMAN_APPROVED' and src.publication_eligibility='ELIGIBLE_PRIMARY' and src.source_type in('ORIGINAL','HUMAN_PROVIDED','OFFICIAL_WEB','VERIFIED_EXTERNAL')
  ) img on true
  where p.business_line='STYLE'
  order by p.sku nulls last,p.name,p.id;
end;$function$;
revoke all on function public.get_style_product_readiness_controlled() from public,anon;
grant execute on function public.get_style_product_readiness_controlled() to authenticated;
comment on function public.get_style_product_readiness_controlled() is 'F5-S1 read-only readiness projection. It never enables visible_on_website; S2 remains a separate controlled cutover.';
