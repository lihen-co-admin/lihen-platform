create or replace view public.unified_asset_artifact_registry
with (security_invoker = true)
as
select
  o.id as storage_object_id,
  o.bucket_id,
  o.name as object_path,
  case
    when o.bucket_id in ('lihen-product-originals', 'lihen-product-web') then 'PRODUCT_IMAGE'
    when o.bucket_id = 'catalog-assets' then 'CATALOG_ASSET'
    when o.bucket_id = 'catalog-pdf-artifacts' then 'CATALOG_PDF'
    else 'STORAGE_OBJECT'
  end as registry_kind,
  case
    when o.bucket_id = 'lihen-product-originals' then 'ORIGINAL'
    when o.bucket_id = 'lihen-product-web' then 'WEB'
    when o.bucket_id = 'catalog-assets' then 'CATALOG'
    when o.bucket_id = 'catalog-pdf-artifacts' then 'PDF'
    else null
  end as variant,
  case
    when o.bucket_id = 'lihen-product-web' and o.name like 'products/%' then split_part(o.name, '/', 2)
    else null
  end as product_id_ref,
  case
    when o.bucket_id = 'lihen-product-web' and o.name like 'products/%' then split_part(o.name, '/', 3)
    else null
  end as product_image_id_ref,
  case
    when o.bucket_id = 'catalog-pdf-artifacts' and o.name like 'catalogs/%' then split_part(o.name, '/', 2)
    else null
  end as catalog_version_id_ref,
  case
    when o.bucket_id = 'catalog-assets' then split_part(o.name, '/', 1)
    else null
  end as asset_namespace,
  case
    when o.bucket_id = 'catalog-assets' then nullif(split_part(o.name, '/', 2), '')
    else null
  end as asset_key,
  nullif(o.metadata ->> 'mimetype', '') as mime_type,
  case
    when (o.metadata ->> 'size') ~ '^[0-9]+$' then (o.metadata ->> 'size')::bigint
    else null
  end as byte_size,
  o.owner_id,
  o.created_at,
  o.updated_at,
  o.last_accessed_at,
  o.metadata,
  o.user_metadata
from storage.objects o
where o.archived_at is null
  and not o.is_delete_marker;

comment on view public.unified_asset_artifact_registry is
  'WAVE 9 / GAP-031 read-only unified registry over existing Supabase Storage objects. No duplicate storage authority; security_invoker preserves underlying Storage RLS. Physical identity remains storage.objects(bucket_id,name).';

grant select on public.unified_asset_artifact_registry to authenticated, service_role;
