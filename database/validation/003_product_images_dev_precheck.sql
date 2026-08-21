-- FASE 1.7 PRECHECK — READ ONLY
-- Do not execute against production as a substitute for DEV validation.

-- 1) product_images physical contract
select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'product_images'
order by ordinal_position;

-- 2) legacy main_image_url existence/type; required for future non-destructive backfill
select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
  and column_name = 'main_image_url';

-- 3) RLS state on product_images
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'product_images';

-- 4) policies on product_images
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'product_images'
order by policyname;

-- 5) invariant audit: products with more than one current main image (adapt is_main name only after schema confirmation)
-- Intentionally not executed automatically until exact deployed columns are confirmed.
