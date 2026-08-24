create or replace function public.get_storefront_products_controlled(
  p_limit integer default 48,
  p_offset integer default 0,
  p_query text default null,
  p_business_line text default null,
  p_brand text default null,
  p_category text default null
)
returns table(
  product_id uuid,
  sku text,
  slug text,
  product_name text,
  business_line text,
  brand text,
  category text,
  subcategory text,
  description text,
  sale_price numeric,
  main_image_url text,
  image_urls jsonb,
  availability text
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_limit integer:=least(greatest(coalesce(p_limit,48),1),100);
  v_offset integer:=greatest(coalesce(p_offset,0),0);
  v_query text:=nullif(lower(btrim(p_query)),'');
begin
  if not exists(
    select 1 from lihen_private.phase_exit_gate_results g
    where g.phase_code='4' and g.status='PASS'
  ) then
    raise exception using errcode='55000',message='LIHEN_PHASE4_NOT_CLOSED';
  end if;

  return query
  select
    p.id,
    p.sku,
    p.slug,
    p.name,
    p.business_line,
    coalesce(b.name,p.brand),
    coalesce(c.name,p.category),
    p.subcategory,
    p.description,
    p.sale_price,
    imgs.main_url,
    imgs.urls,
    case
      when coalesce(s.stock_available,0)>5 then 'AVAILABLE'
      when coalesce(s.stock_available,0)>0 then 'LOW_STOCK'
      when coalesce(s.stock_pending,0)>0 then 'COMING_SOON'
      else 'OUT_OF_STOCK'
    end
  from public.products p
  left join public.brands b on b.id=p.brand_id
  left join public.categories c on c.id=p.category_id
  left join public.inventory_stock s on s.product_id=p.id
  join lateral (
    select
      (array_agg(pi.public_url order by pi.is_main desc,pi.sort_order asc,pi.created_at asc,pi.id asc))[1] as main_url,
      jsonb_agg(pi.public_url order by pi.is_main desc,pi.sort_order asc,pi.created_at asc,pi.id asc) as urls
    from public.product_images pi
    where pi.product_id=p.id and pi.status='ACTIVE' and btrim(pi.public_url)<>''
  ) imgs on imgs.main_url is not null
  where p.status='ACTIVE'
    and p.visible_on_website=true
    and p.sale_price is not null
    and p.sale_price>=0
    and (nullif(btrim(p_business_line),'') is null or p.business_line=btrim(p_business_line))
    and (nullif(btrim(p_brand),'') is null or lower(coalesce(b.name,p.brand,''))=lower(btrim(p_brand)))
    and (nullif(btrim(p_category),'') is null or lower(coalesce(c.name,p.category,''))=lower(btrim(p_category)))
    and (
      v_query is null
      or lower(p.name) like '%'||v_query||'%'
      or lower(coalesce(p.sku,'')) like '%'||v_query||'%'
      or lower(coalesce(b.name,p.brand,'')) like '%'||v_query||'%'
      or lower(coalesce(c.name,p.category,'')) like '%'||v_query||'%'
      or lower(coalesce(p.description,'')) like '%'||v_query||'%'
    )
  order by p.business_line,coalesce(b.name,p.brand,''),coalesce(c.name,p.category,''),p.name,p.id
  limit v_limit offset v_offset;
end;
$function$;

revoke all on function public.get_storefront_products_controlled(integer,integer,text,text,text,text) from public;
grant execute on function public.get_storefront_products_controlled(integer,integer,text,text,text,text) to anon,authenticated;

comment on function public.get_storefront_products_controlled(integer,integer,text,text,text,text) is
'FASE 5 canonical public storefront projection. Exposes only publishable products and semantic availability; exact operational stock is not exposed. Read remains blocked until the FASE 4 exit gate is PASS.';
