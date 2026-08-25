create or replace function public.get_storefront_brands_controlled(
  p_business_line text default 'BEAUTY_CARE',
  p_limit integer default 60
)
returns table(
  brand_id uuid,
  brand_name text,
  logo_url text,
  visible_product_count bigint
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_limit integer:=least(greatest(coalesce(p_limit,60),1),100);
  v_business_line text:=nullif(btrim(p_business_line),'');
begin
  if not exists(
    select 1 from lihen_private.phase_exit_gate_results g
    where g.phase_code='4' and g.status='PASS'
  ) then
    raise exception using errcode='55000',message='LIHEN_PHASE4_NOT_CLOSED';
  end if;

  return query
  select
    b.id,
    b.name,
    b.logo_url,
    count(*)::bigint
  from public.brands b
  join public.products p on p.brand_id=b.id
  where b.status='ACTIVE'
    and p.status='ACTIVE'
    and p.visible_on_website=true
    and p.sale_price is not null
    and p.sale_price>=0
    and (v_business_line is null or p.business_line=v_business_line)
    and exists(
      select 1
      from public.product_images pi
      where pi.product_id=p.id
        and pi.status='ACTIVE'
        and btrim(pi.public_url)<>''
    )
  group by b.id,b.name,b.logo_url
  having count(*)>0
  order by count(*) desc,b.name asc,b.id asc
  limit v_limit;
end;
$function$;

revoke all on function public.get_storefront_brands_controlled(text,integer) from public;
grant execute on function public.get_storefront_brands_controlled(text,integer) to anon,authenticated;

comment on function public.get_storefront_brands_controlled(text,integer) is
'FASE 5 C3 canonical public brand projection. Returns only ACTIVE canonical brands that currently have publishable Storefront products with an ACTIVE image; counts are derived at read time and no operational stock is exposed.';
