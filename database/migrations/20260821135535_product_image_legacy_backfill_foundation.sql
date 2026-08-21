-- FASE 1.15 — Product Image Legacy Backfill Foundation
-- PREVIEW ONLY. This migration creates no product_images rows.

create or replace function lihen_private.preview_product_image_legacy_backfill()
returns table (
  product_id uuid,
  sku text,
  catalog_code text,
  product_name text,
  legacy_main_image_url text,
  existing_image_count bigint,
  existing_active_main_count bigint,
  exact_url_image_count bigint,
  shared_legacy_url_product_count bigint,
  classification text,
  eligible_for_auto_backfill boolean,
  detail text
)
language sql
security definer
stable
set search_path = ''
as $$
  with base as (
    select
      p.id as product_id,
      p.sku,
      p.catalog_code,
      p.name as product_name,
      nullif(btrim(p.main_image_url), '') as legacy_main_image_url
    from public.products p
  ), counts as (
    select
      b.*,
      (select count(*) from public.product_images i where i.product_id = b.product_id) as existing_image_count,
      (select count(*) from public.product_images i where i.product_id = b.product_id and i.status = 'ACTIVE' and i.is_main) as existing_active_main_count,
      (select count(*) from public.product_images i where i.product_id = b.product_id and i.public_url = b.legacy_main_image_url) as exact_url_image_count,
      case when b.legacy_main_image_url is null then 0::bigint else
        (select count(*) from base b2 where b2.legacy_main_image_url = b.legacy_main_image_url)
      end as shared_legacy_url_product_count,
      exists (
        select 1 from public.product_images i
        where i.product_id = b.product_id
          and i.public_url = b.legacy_main_image_url
          and i.status = 'ACTIVE'
          and i.is_main
          and i.source_type = 'LEGACY_MAIN_IMAGE_URL'
      ) as exact_backfill_exists,
      exists (
        select 1 from public.product_images i
        where i.product_id = b.product_id
          and i.public_url = b.legacy_main_image_url
          and not (i.status = 'ACTIVE' and i.is_main and i.source_type = 'LEGACY_MAIN_IMAGE_URL')
      ) as exact_url_wrong_state
    from base b
  )
  select
    c.product_id,
    c.sku,
    c.catalog_code,
    c.product_name,
    c.legacy_main_image_url,
    c.existing_image_count,
    c.existing_active_main_count,
    c.exact_url_image_count,
    c.shared_legacy_url_product_count,
    case
      when c.legacy_main_image_url is null then 'SKIP_NO_LEGACY_URL'
      when c.exact_backfill_exists then 'ALREADY_BACKFILLED'
      when c.shared_legacy_url_product_count > 1 then 'CONFLICT_SHARED_LEGACY_URL'
      when c.existing_active_main_count > 0 then 'CONFLICT_ACTIVE_MAIN'
      when c.exact_url_wrong_state then 'CONFLICT_MATCHING_IMAGE_STATE'
      when c.existing_image_count > 0 then 'REVIEW_EXISTING_IMAGES'
      else 'READY'
    end as classification,
    (
      c.legacy_main_image_url is not null
      and not c.exact_backfill_exists
      and c.shared_legacy_url_product_count = 1
      and c.existing_active_main_count = 0
      and not c.exact_url_wrong_state
      and c.existing_image_count = 0
    ) as eligible_for_auto_backfill,
    case
      when c.legacy_main_image_url is null then 'Legacy products.main_image_url is NULL/blank; nothing to migrate.'
      when c.exact_backfill_exists then 'Canonical LEGACY_MAIN_IMAGE_URL row already exists as ACTIVE main.'
      when c.shared_legacy_url_product_count > 1 then 'The same legacy URL is referenced by multiple products; manual review required.'
      when c.existing_active_main_count > 0 then 'An ACTIVE main image already exists; automatic insert would violate canonical main-image intent.'
      when c.exact_url_wrong_state then 'The legacy URL already exists in product_images but with a different state/source/main flag.'
      when c.existing_image_count > 0 then 'Product already has canonical images; review before introducing legacy URL as main.'
      else 'Safe candidate for future non-destructive backfill.'
    end as detail
  from counts c
  order by c.product_id;
$$;

revoke execute on function lihen_private.preview_product_image_legacy_backfill() from public, anon, authenticated;
grant execute on function lihen_private.preview_product_image_legacy_backfill() to service_role;

create or replace function lihen_private.product_image_legacy_backfill_summary()
returns table (classification text, candidate_count bigint)
language sql
security definer
stable
set search_path = ''
as $$
  select p.classification, count(*)::bigint
  from lihen_private.preview_product_image_legacy_backfill() p
  group by p.classification
  order by p.classification;
$$;

revoke execute on function lihen_private.product_image_legacy_backfill_summary() from public, anon, authenticated;
grant execute on function lihen_private.product_image_legacy_backfill_summary() to service_role;

comment on function lihen_private.preview_product_image_legacy_backfill() is
  'FASE 1.15 dry-run only. Classifies legacy products.main_image_url candidates; never writes product_images.';
comment on function lihen_private.product_image_legacy_backfill_summary() is
  'FASE 1.15 dry-run summary. No business data writes.';
