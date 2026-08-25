create or replace function public.get_storefront_products_media_v2_controlled(
  p_limit integer default 48,
  p_offset integer default 0,
  p_query text default null,
  p_business_line text default null,
  p_brand text default null,
  p_category text default null
)
returns table(
  product_id uuid, sku text, slug text, product_name text, business_line text,
  brand text, category text, subcategory text, description text, sale_price numeric,
  main_image_url text, image_urls jsonb, card_media jsonb, detail_media jsonb,
  gallery_media jsonb, availability text
)
language plpgsql security definer set search_path=''
as $function$
declare
  v_limit integer:=least(greatest(coalesce(p_limit,48),1),100);
  v_offset integer:=greatest(coalesce(p_offset,0),0);
  v_query text:=nullif(lower(btrim(p_query)),'');
begin
  if not exists(select 1 from lihen_private.phase_exit_gate_results g where g.phase_code='4' and g.status='PASS') then
    raise exception using errcode='55000',message='LIHEN_PHASE4_NOT_CLOSED';
  end if;

  return query
  select p.id,p.sku,p.slug,p.name,p.business_line,coalesce(b.name,p.brand),coalesce(c.name,p.category),p.subcategory,p.description,p.sale_price,
    card.public_url,
    coalesce(gallery.legacy_urls,jsonb_build_array(card.public_url)),
    jsonb_build_object('url',card.public_url,'width',card.width_px,'height',card.height_px,'profile','WEB_CARD'),
    case when detail.public_url is null then null else jsonb_build_object('url',detail.public_url,'width',detail.width_px,'height',detail.height_px,'profile','WEB_DETAIL') end,
    coalesce(gallery.detail_media,'[]'::jsonb),
    case when coalesce(s.stock_available,0)>5 then 'AVAILABLE' when coalesce(s.stock_available,0)>0 then 'LOW_STOCK' when coalesce(s.stock_pending,0)>0 then 'COMING_SOON' else 'OUT_OF_STOCK' end
  from public.products p
  left join public.brands b on b.id=p.brand_id
  left join public.categories c on c.id=p.category_id
  left join public.inventory_stock s on s.product_id=p.id
  join lateral (
    select pi.public_url,a.width_px,a.height_px
    from public.product_images pi
    join lihen_private.product_image_storage_assets a on a.product_image_id=pi.id and a.status='ACTIVE' and a.rendition_profile='WEB_CARD'
    where pi.product_id=p.id and pi.status='ACTIVE' and pi.derivative_profile='WEB_CARD' and btrim(pi.public_url)<>'' and a.width_px>0 and a.height_px>0
    order by pi.is_main desc,pi.sort_order asc,pi.created_at asc,pi.id asc limit 1
  ) card on true
  left join lateral (
    select pi.public_url,a.width_px,a.height_px
    from public.product_images pi
    join lihen_private.product_image_storage_assets a on a.product_image_id=pi.id and a.status='ACTIVE' and a.rendition_profile='WEB_DETAIL'
    where pi.product_id=p.id and pi.status='ACTIVE' and pi.derivative_profile='WEB_DETAIL' and btrim(pi.public_url)<>'' and a.width_px>0 and a.height_px>0
    order by pi.is_main desc,pi.sort_order asc,pi.created_at asc,pi.id asc limit 1
  ) detail on true
  left join lateral (
    select
      jsonb_agg(pi.public_url order by pi.is_main desc,pi.sort_order,pi.created_at,pi.id) filter(where pi.derivative_profile='WEB_CARD') as legacy_urls,
      jsonb_agg(jsonb_build_object('url',pi.public_url,'width',a.width_px,'height',a.height_px,'profile','WEB_DETAIL') order by pi.is_main desc,pi.sort_order,pi.created_at,pi.id) filter(where pi.derivative_profile='WEB_DETAIL') as detail_media
    from public.product_images pi
    join lihen_private.product_image_storage_assets a on a.product_image_id=pi.id and a.status='ACTIVE'
    where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>'' and a.width_px>0 and a.height_px>0
  ) gallery on true
  where p.status='ACTIVE' and p.visible_on_website=true and p.sale_price is not null and p.sale_price>=0
    and (nullif(btrim(p_business_line),'') is null or p.business_line=btrim(p_business_line))
    and (nullif(btrim(p_brand),'') is null or lower(coalesce(b.name,p.brand,''))=lower(btrim(p_brand)))
    and (nullif(btrim(p_category),'') is null or lower(coalesce(c.name,p.category,''))=lower(btrim(p_category)))
    and (v_query is null or lower(p.name) like '%'||v_query||'%' or lower(coalesce(p.sku,'')) like '%'||v_query||'%' or lower(coalesce(b.name,p.brand,'')) like '%'||v_query||'%' or lower(coalesce(c.name,p.category,'')) like '%'||v_query||'%' or lower(coalesce(p.description,'')) like '%'||v_query||'%')
  order by p.business_line,coalesce(b.name,p.brand,''),coalesce(c.name,p.category,''),p.name,p.id
  limit v_limit offset v_offset;
end;
$function$;
revoke all on function public.get_storefront_products_media_v2_controlled(integer,integer,text,text,text,text) from public;
grant execute on function public.get_storefront_products_media_v2_controlled(integer,integer,text,text,text,text) to anon,authenticated;
comment on function public.get_storefront_products_media_v2_controlled(integer,integer,text,text,text,text) is 'F5-M2 read-only Storefront media projection. WEB_CARD is required; WEB_DETAIL is optional and never synthesized by upscaling.';
