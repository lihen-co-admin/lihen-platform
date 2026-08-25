create or replace function public.get_storefront_products_qa_b_controlled(
  p_limit integer default 48,
  p_offset integer default 0,
  p_query text default null,
  p_business_line text default null,
  p_brand text default null,
  p_category text default null,
  p_collection text default null,
  p_max_price numeric default null,
  p_available_only boolean default false
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
  v_collection text:=nullif(upper(btrim(p_collection)),'');
  v_max_price numeric:=case when p_max_price is null then null else greatest(p_max_price,0) end;
begin
  if not exists(select 1 from lihen_private.phase_exit_gate_results g where g.phase_code='4' and g.status='PASS') then
    raise exception using errcode='55000',message='LIHEN_PHASE4_NOT_CLOSED';
  end if;
  if v_collection is not null and v_collection <> 'CARE' then
    raise exception using errcode='22023',message='LIHEN_UNSUPPORTED_STOREFRONT_COLLECTION';
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
    and (v_max_price is null or p.sale_price<=v_max_price)
    and (not coalesce(p_available_only,false) or coalesce(s.stock_available,0)>0)
    and (nullif(btrim(p_business_line),'') is null or p.business_line=btrim(p_business_line))
    and (nullif(btrim(p_brand),'') is null or lower(coalesce(b.name,p.brand,''))=lower(btrim(p_brand)))
    and (nullif(btrim(p_category),'') is null or lower(coalesce(c.name,p.category,''))=lower(btrim(p_category)))
    and (v_query is null or lower(p.name) like '%'||v_query||'%' or lower(coalesce(p.sku,'')) like '%'||v_query||'%' or lower(coalesce(b.name,p.brand,'')) like '%'||v_query||'%' or lower(coalesce(c.name,p.category,'')) like '%'||v_query||'%' or lower(coalesce(p.description,'')) like '%'||v_query||'%')
    and (
      v_collection is null
      or (
        v_collection='CARE' and p.business_line='BEAUTY_CARE'
        and lower(concat_ws(' ',p.name,coalesce(p.subcategory,''),coalesce(p.description,''))) ~ '(cuidado|skincare|skin care|shampoo|champu|champú|acondicionador|acondi|tratamiento|mascarilla|crema|locion|loción|corporal|capilar|cabello|piel|exfoliante|mantequilla|gel de ducha|protector solar|bloqueador|aceite corporal|aceite de puntas|bioterapia|biomascarilla|bruma facial|tonico|tónico|limpiador|agua micelar|desodorante|antitranspirante|jabon|jabón|contorno de ojos|balsamo|bálsamo|leave in|termoprotector|protector termico|protector térmico|queratina|keratina|ampolla|hidratante|serum|sérum)'
        and lower(p.name) !~ '(gloss|labial|rubor|tinta|sombra|delineador|pestañ|ceja|corrector|iluminador|lip[[:space:]-]|polvo compacto|base maquillaje|base de maquillaje)'
      )
    )
  order by
    case when coalesce(s.stock_available,0)>5 then 1 when coalesce(s.stock_available,0)>0 then 2 when coalesce(s.stock_pending,0)>0 then 3 else 4 end,
    p.business_line,coalesce(b.name,p.brand,''),coalesce(c.name,p.category,''),p.name,p.id
  limit v_limit offset v_offset;
end;
$function$;

revoke all on function public.get_storefront_products_qa_b_controlled(integer,integer,text,text,text,text,text,numeric,boolean) from public;
grant execute on function public.get_storefront_products_qa_b_controlled(integer,integer,text,text,text,text,text,numeric,boolean) to anon,authenticated;
comment on function public.get_storefront_products_qa_b_controlled(integer,integer,text,text,text,text,text,numeric,boolean) is 'F5 QA-B read-only commercial storefront projection. Prioritizes availability and supports budget/availability filters for canonical gift discovery.';
