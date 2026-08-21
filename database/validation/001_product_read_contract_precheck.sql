-- LIHEN Platform — FASE 1.2.1
-- Product Read Contract precheck for Supabase DEV.
-- READ-ONLY. This script must be executed against DEV, never used to mutate production.

-- -----------------------------------------------------------------------------
-- A. Expected physical columns and compatible PostgreSQL types
-- -----------------------------------------------------------------------------
WITH expected(column_name, accepted_types) AS (
  VALUES
    ('id', ARRAY['uuid', 'text', 'character varying']::text[]),
    ('sku', ARRAY['text', 'character varying']::text[]),
    ('catalog_code', ARRAY['text', 'character varying']::text[]),
    ('name', ARRAY['text', 'character varying']::text[]),
    ('status', ARRAY['text', 'character varying', 'USER-DEFINED']::text[]),
    ('sale_price', ARRAY['numeric', 'decimal', 'integer', 'bigint', 'double precision', 'real']::text[])
), actual AS (
  SELECT
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'products'
)
SELECT
  e.column_name,
  a.data_type,
  a.udt_name,
  a.is_nullable,
  a.column_default,
  CASE
    WHEN a.column_name IS NULL THEN 'FAIL_MISSING'
    WHEN a.data_type = ANY(e.accepted_types) THEN 'PASS'
    ELSE 'REVIEW_TYPE'
  END AS contract_status
FROM expected e
LEFT JOIN actual a USING (column_name)
ORDER BY e.column_name;

-- -----------------------------------------------------------------------------
-- B. Table-level RLS state
-- Expected for LIHEN private master table: relrowsecurity = true
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'products'
  AND c.relkind IN ('r', 'p');

-- -----------------------------------------------------------------------------
-- C. Policies currently deployed on products
-- Review roles, command and predicates. No write policy is required by FASE 1.2/1.3.
-- -----------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'products'
ORDER BY policyname;

-- -----------------------------------------------------------------------------
-- D. Real status vocabulary currently present
-- Every returned value must be supported by LegacyProductMapper before cutover.
-- -----------------------------------------------------------------------------
SELECT status, COUNT(*) AS row_count
FROM public.products
GROUP BY status
ORDER BY row_count DESC, status;

-- -----------------------------------------------------------------------------
-- E. Data-quality gates required by Product domain
-- Expected results: 0 rows for each query.
-- -----------------------------------------------------------------------------
SELECT id, name
FROM public.products
WHERE name IS NULL OR btrim(name) = '';

SELECT id, sale_price
FROM public.products
WHERE sale_price IS NULL OR sale_price < 0;

-- -----------------------------------------------------------------------------
-- F. Read contract sample (same six fields requested by SupabaseProductRepository)
-- -----------------------------------------------------------------------------
SELECT id, sku, catalog_code, name, status, sale_price
FROM public.products
ORDER BY name
LIMIT 10;
