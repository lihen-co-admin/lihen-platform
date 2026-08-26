create or replace view lihen_private.phase5_qac_product_detail_media_closure_status
with (security_invoker = true)
as
with readiness as (
  select
    count(*)::bigint as readiness_total,
    count(*) filter (where visible_on_website = true and status = 'ACTIVE')::bigint as visible_active_products,
    count(*) filter (where active_images = 0)::bigint as no_media_products,
    count(*) filter (where active_images = 1)::bigint as single_image_products,
    count(*) filter (where active_images >= 2)::bigint as multi_image_products,
    count(*) filter (where web_detail_images >= 1)::bigint as web_detail_products,
    count(*) filter (where active_images >= 2 and web_detail_images >= 1)::bigint as gallery_ready_products
  from lihen_private.beauty_media_intelligence_readiness
),
projection as (
  select count(distinct p.id)::bigint as media_v2_publishable_products
  from public.products p
  where p.status = 'ACTIVE'
    and p.visible_on_website = true
    and p.sale_price is not null
    and p.sale_price >= 0
    and exists (
      select 1
      from public.product_images pi
      join lihen_private.product_image_storage_assets a
        on a.product_image_id = pi.id
       and a.status = 'ACTIVE'
       and a.rendition_profile = 'WEB_CARD'
       and a.width_px > 0
       and a.height_px > 0
      where pi.product_id = p.id
        and pi.status = 'ACTIVE'
        and pi.derivative_profile = 'WEB_CARD'
        and btrim(pi.public_url) <> ''
    )
),
enrichment as (
  select
    count(*) filter (where verification_status='VERIFIED' and publication_status='APPROVED')::bigint as approved_evidence,
    count(distinct product_id) filter (where verification_status='VERIFIED' and publication_status='APPROVED')::bigint as products_with_approved_evidence
  from lihen_private.product_enrichment_evidence
),
contracts as (
  select
    to_regprocedure('public.get_storefront_products_media_v2_controlled(integer,integer,text,text,text,text)') is not null as media_v2_rpc_present,
    to_regprocedure('public.get_storefront_product_enrichment_controlled(uuid)') is not null as enrichment_rpc_present,
    exists(select 1 from lihen_private.phase_exit_gate_results g where g.phase_code='5' and g.status='PASS') as phase5_storefront_gate_pass
)
select
  case
    when c.phase5_storefront_gate_pass
      and c.media_v2_rpc_present
      and c.enrichment_rpc_present
      and p.media_v2_publishable_products = r.visible_active_products
    then 'PASS'
    else 'BLOCKED'
  end::text as technical_status,
  case
    when r.no_media_products > 0
      or r.single_image_products > 0
      or r.gallery_ready_products < r.visible_active_products
    then 'OPEN'
    else 'CLEAR'
  end::text as media_content_debt_status,
  r.readiness_total,
  r.visible_active_products,
  p.media_v2_publishable_products,
  r.no_media_products,
  r.single_image_products,
  r.multi_image_products,
  r.web_detail_products,
  r.gallery_ready_products,
  e.approved_evidence,
  e.products_with_approved_evidence,
  c.phase5_storefront_gate_pass,
  c.media_v2_rpc_present,
  c.enrichment_rpc_present,
  jsonb_strip_nulls(jsonb_build_object(
    'non_blocking_debt', case
      when r.no_media_products > 0 or r.single_image_products > 0 or r.gallery_ready_products < r.visible_active_products
      then jsonb_build_array(
        'PHASE5_QAC_MEDIA_GALLERY_ENRICHMENT_PROGRESSIVE',
        'PHASE5_QAC_WEB_DETAIL_ASSETS_PROGRESSIVE',
        'PHASE5_QAC_APPROVED_ENRICHMENT_PROGRESSIVE'
      )
      else null
    end,
    'policy', 'Product Detail remains technically publishable with canonical WEB_CARD fallback; premium gallery and enrichment are progressive and must never be fabricated.'
  )) as metrics
from readiness r
cross join projection p
cross join enrichment e
cross join contracts c;

revoke all on lihen_private.phase5_qac_product_detail_media_closure_status from public, anon, authenticated;

drop function if exists public.get_phase5_qac_product_detail_media_closure_status_controlled();
create function public.get_phase5_qac_product_detail_media_closure_status_controlled()
returns table(
  technical_status text,
  media_content_debt_status text,
  readiness_total bigint,
  visible_active_products bigint,
  media_v2_publishable_products bigint,
  no_media_products bigint,
  single_image_products bigint,
  multi_image_products bigint,
  web_detail_products bigint,
  gallery_ready_products bigint,
  approved_evidence bigint,
  products_with_approved_evidence bigint,
  metrics jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode='42501', message='LIHEN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.authorization_status = 'ACTIVE'
      and p.role_code in ('OWNER','ADMIN')
  ) then
    raise exception using errcode='42501', message='LIHEN_QAC_PRODUCT_DETAIL_MEDIA_STATUS_FORBIDDEN';
  end if;

  return query
  select
    s.technical_status,
    s.media_content_debt_status,
    s.readiness_total,
    s.visible_active_products,
    s.media_v2_publishable_products,
    s.no_media_products,
    s.single_image_products,
    s.multi_image_products,
    s.web_detail_products,
    s.gallery_ready_products,
    s.approved_evidence,
    s.products_with_approved_evidence,
    s.metrics
  from lihen_private.phase5_qac_product_detail_media_closure_status s;
end;
$$;

revoke all on function public.get_phase5_qac_product_detail_media_closure_status_controlled() from public, anon;
grant execute on function public.get_phase5_qac_product_detail_media_closure_status_controlled() to authenticated;
