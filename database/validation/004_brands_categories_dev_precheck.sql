-- FASE 1.8 — BRANDS + CATEGORIES / DEV PRECHECK
-- SOLO LECTURA. No crea tablas, columnas, constraints ni modifica datos.

-- 1) Confirmar textos legacy disponibles en products.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
  and column_name in ('business_line','brand','category','subcategory','brand_id','category_id')
order by column_name;

-- 2) Inventario de valores legacy para preparar mappings; no normaliza ni fusiona.
select trim(brand) as legacy_brand, count(*) as product_count
from public.products
where nullif(trim(brand), '') is not null
group by trim(brand)
order by product_count desc, legacy_brand;

select
  trim(business_line) as business_line,
  trim(category) as legacy_category,
  trim(subcategory) as legacy_subcategory,
  count(*) as product_count
from public.products
where coalesce(nullif(trim(category), ''), nullif(trim(subcategory), '')) is not null
group by trim(business_line), trim(category), trim(subcategory)
order by business_line, legacy_category, legacy_subcategory;

-- 3) Detectar si las tablas canónicas ya existen en DEV. El resultado es informativo.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('brands','categories')
order by table_name;

-- 4) Si existen, inspeccionar estructura física sin asumirla.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('brands','categories')
order by table_name, ordinal_position;

-- 5) RLS de tablas canónicas si ya existen.
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('brands','categories');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('brands','categories')
order by tablename, policyname;

-- GATE: no habilitar writes/backfill hasta revisar duplicados semánticos,
-- mappings brand/category, FKs, constraints y RLS en DEV real.
