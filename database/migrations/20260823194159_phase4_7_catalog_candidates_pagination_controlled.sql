create or replace function public.get_pdf_catalog_candidates_page_controlled(
  p_limit integer default 500,
  p_offset integer default 0
)
returns table(
  product_id uuid,
  sku text,
  catalog_code text,
  product_name text,
  business_line text,
  brand text,
  category text,
  subcategory text,
  sale_price numeric,
  product_status text,
  image_id uuid,
  image_url text,
  image_alt text,
  eligible boolean,
  blocking_reasons text[]
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit,500),1),500);
  v_offset integer := greatest(coalesce(p_offset,0),0);
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id=v_actor
      and p.authorization_status='ACTIVE'
      and p.role_code in ('OWNER','ADMIN','OPERATOR','VIEWER')
  ) then
    raise exception using errcode='42501', message='LIHEN_CATALOG_READ_FORBIDDEN';
  end if;

  return query
  select
    p.id,
    p.sku,
    p.catalog_code,
    p.name,
    p.business_line,
    coalesce(b.name,p.brand),
    coalesce(c.name,p.category),
    p.subcategory,
    p.sale_price,
    p.status,
    i.id,
    i.public_url,
    i.alt_text,
    (p.status='ACTIVE' and p.sale_price >= 0 and i.id is not null) as eligible,
    array_remove(array[
      case when p.status <> 'ACTIVE' then 'PRODUCT_NOT_ACTIVE' end,
      case when p.sale_price < 0 then 'INVALID_SALE_PRICE' end,
      case when i.id is null then 'MISSING_CANONICAL_IMAGE' end
    ], null)::text[]
  from public.products p
  left join public.brands b on b.id=p.brand_id
  left join public.categories c on c.id=p.category_id
  left join lateral (
    select pi.id, pi.public_url, pi.alt_text
    from public.product_images pi
    where pi.product_id=p.id
      and pi.status='ACTIVE'
      and btrim(pi.public_url)<>''
    order by pi.is_main desc, pi.sort_order asc, pi.created_at asc, pi.id asc
    limit 1
  ) i on true
  order by p.business_line, coalesce(c.name,p.category,''), coalesce(b.name,p.brand,''), p.name, p.id
  limit v_limit offset v_offset;
end;
$function$;

revoke all on function public.get_pdf_catalog_candidates_page_controlled(integer,integer) from public, anon;
grant execute on function public.get_pdf_catalog_candidates_page_controlled(integer,integer) to authenticated;

comment on function public.get_pdf_catalog_candidates_page_controlled(integer,integer) is
  'Paged controlled candidate projection for FASE 4 PDF catalog selection. Avoids PostgREST row caps while preserving canonical ordering.';
