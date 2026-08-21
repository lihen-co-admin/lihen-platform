-- FASE 1.8.1 — DEV TAXONOMY MAPPING QUALITY PRECHECK
-- SOLO LECTURA. Ejecutar contra Supabase DEV real.
-- Objetivo: producir la evidencia necesaria antes de cualquier backfill.

-- A. Conteos base
select
  count(*) as total_products,
  count(*) filter (where nullif(trim(brand), '') is not null) as products_with_brand_text,
  count(*) filter (where nullif(trim(category), '') is not null) as products_with_category_text,
  count(*) filter (where nullif(trim(subcategory), '') is not null) as products_with_subcategory_text
from public.products;

-- B. Marcas legacy exactas + versión normalizada para detectar colisiones semánticas.
with brand_inventory as (
  select
    trim(brand) as legacy_brand,
    lower(regexp_replace(trim(translate(brand,
      'ÁÉÍÓÚÜÑáéíóúüñ',
      'AEIOUUNaeiouun')),'\\s+',' ','g')) as normalized_brand,
    count(*) as product_count
  from public.products
  where nullif(trim(brand), '') is not null
  group by trim(brand)
)
select *
from brand_inventory
order by normalized_brand, legacy_brand;

-- C. Posibles colisiones: dos o más textos legacy caen en la misma normalización.
with brand_inventory as (
  select distinct
    trim(brand) as legacy_brand,
    lower(regexp_replace(trim(translate(brand,
      'ÁÉÍÓÚÜÑáéíóúüñ',
      'AEIOUUNaeiouun')),'\\s+',' ','g')) as normalized_brand
  from public.products
  where nullif(trim(brand), '') is not null
)
select
  normalized_brand,
  array_agg(legacy_brand order by legacy_brand) as legacy_values,
  count(*) as variants
from brand_inventory
group by normalized_brand
having count(*) > 1
order by variants desc, normalized_brand;

-- D. Rutas categoría/subcategoría exactas.
select
  nullif(trim(business_line), '') as business_line,
  nullif(trim(category), '') as legacy_category,
  nullif(trim(subcategory), '') as legacy_subcategory,
  count(*) as product_count
from public.products
group by
  nullif(trim(business_line), ''),
  nullif(trim(category), ''),
  nullif(trim(subcategory), '')
order by business_line nulls last, legacy_category nulls last, legacy_subcategory nulls last;

-- E. Detectar subcategorías homónimas bajo más de una categoría.
select
  trim(subcategory) as legacy_subcategory,
  array_agg(distinct trim(category) order by trim(category)) as parent_categories,
  count(distinct trim(category)) as parent_count
from public.products
where nullif(trim(subcategory), '') is not null
  and nullif(trim(category), '') is not null
group by trim(subcategory)
having count(distinct trim(category)) > 1
order by parent_count desc, legacy_subcategory;

-- F. Detectar categorías con más de una business_line.
select
  trim(category) as legacy_category,
  array_agg(distinct trim(business_line) order by trim(business_line)) as business_lines,
  count(distinct trim(business_line)) as business_line_count
from public.products
where nullif(trim(category), '') is not null
  and nullif(trim(business_line), '') is not null
group by trim(category)
having count(distinct trim(business_line)) > 1
order by business_line_count desc, legacy_category;

-- G. Estado de referencias canónicas si ya existen columnas.
-- Si brand_id/category_id todavía no existen, esta consulta debe omitirse.
-- select
--   count(*) filter (where brand_id is not null) as products_with_brand_id,
--   count(*) filter (where category_id is not null) as products_with_category_id
-- from public.products;

-- GATE MANUAL:
-- 1) Toda marca legacy significativa debe terminar en EXACT / MERGE_REVIEW / UNMAPPED.
-- 2) Toda ruta categoría/subcategoría debe tener destino canónico inequívoco.
-- 3) No se permite backfill automático sobre colisiones no revisadas.
