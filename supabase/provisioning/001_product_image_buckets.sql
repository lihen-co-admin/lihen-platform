-- FASE 1.17.1 — Product image bucket provisioning
-- Supabase documents SQL as a supported bucket creation mechanism.
-- This script creates/normalizes bucket definitions only. It creates no objects
-- and no storage.objects policies.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'lihen-product-originals',
    'lihen-product-originals',
    false,
    12582912,
    array['image/jpeg','image/png','image/webp']::text[]
  ),
  (
    'lihen-product-web',
    'lihen-product-web',
    true,
    3145728,
    array['image/jpeg','image/png','image/webp']::text[]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
