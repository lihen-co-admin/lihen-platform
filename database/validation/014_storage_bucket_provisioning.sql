-- FASE 1.17.1 — STORAGE BUCKET PROVISIONING VALIDATION
-- READ-ONLY validation. It must not mutate storage schema or objects.

with expected as (
  select * from (values
    ('lihen-product-originals'::text, false, 12582912::bigint, array['image/jpeg','image/png','image/webp']::text[]),
    ('lihen-product-web'::text, true, 3145728::bigint, array['image/jpeg','image/png','image/webp']::text[])
  ) as v(id, expected_public, expected_limit, expected_mimes)
), actual as (
  select
    b.id,
    coalesce(b.public, false) as actual_public,
    b.file_size_limit,
    b.allowed_mime_types
  from storage.buckets b
  where b.id in ('lihen-product-originals', 'lihen-product-web')
)
select
  e.id,
  (a.id is not null) as exists,
  e.expected_public,
  a.actual_public,
  e.expected_limit,
  a.file_size_limit as actual_limit,
  e.expected_mimes,
  a.allowed_mime_types as actual_mimes,
  (
    a.id is not null
    and a.actual_public = e.expected_public
    and a.file_size_limit = e.expected_limit
    and a.allowed_mime_types @> e.expected_mimes
    and e.expected_mimes @> a.allowed_mime_types
  ) as configuration_matches
from expected e
left join actual a using (id)
order by e.id;

-- No product-image objects should exist at the end of provisioning-only phase.
select
  count(*) filter (where bucket_id = 'lihen-product-originals') as originals_objects,
  count(*) filter (where bucket_id = 'lihen-product-web') as web_objects
from storage.objects;

-- No LIHEN product-image Storage policies should be active yet.
select
  count(*) as lihen_product_storage_policies
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    coalesce(qual, '') ilike '%lihen-product-originals%'
    or coalesce(qual, '') ilike '%lihen-product-web%'
    or coalesce(with_check, '') ilike '%lihen-product-originals%'
    or coalesce(with_check, '') ilike '%lihen-product-web%'
  );
