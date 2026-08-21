-- FASE 1.8.1 — ACCEPTANCE GATE
-- SOLO LECTURA. Ejecutar DESPUÉS del backfill DEV y ANTES de cutover.

-- 1) Cobertura brand_id para productos que tienen marca legacy.
select count(*) as products_with_legacy_brand_but_no_brand_id
from public.products
where nullif(trim(brand), '') is not null
  and brand_id is null;

-- 2) Cobertura category_id para productos con category/subcategory legacy.
select count(*) as products_with_legacy_category_but_no_category_id
from public.products
where coalesce(nullif(trim(category), ''), nullif(trim(subcategory), '')) is not null
  and category_id is null;

-- 3) Huérfanos brand.
select count(*) as orphan_brand_refs
from public.products p
left join public.brands b on b.id = p.brand_id
where p.brand_id is not null and b.id is null;

-- 4) Huérfanos category.
select count(*) as orphan_category_refs
from public.products p
left join public.categories c on c.id = p.category_id
where p.category_id is not null and c.id is null;

-- 5) Duplicados canónicos de marca por normalized_name.
select normalized_name, count(*)
from public.brands
group by normalized_name
having count(*) > 1;

-- 6) Duplicados de categoría dentro del mismo padre/business line.
select parent_id, business_line, normalized_name, count(*)
from public.categories
group by parent_id, business_line, normalized_name
having count(*) > 1;

-- 7) Self-parent directo.
select count(*) as direct_self_cycles
from public.categories
where parent_id = id;

-- 8) Comparación legible para muestreo humano.
select
  p.id,
  p.name,
  p.brand as legacy_brand,
  b.name as canonical_brand,
  p.category as legacy_category,
  p.subcategory as legacy_subcategory,
  c.name as canonical_category,
  pc.name as canonical_parent_category
from public.products p
left join public.brands b on b.id = p.brand_id
left join public.categories c on c.id = p.category_id
left join public.categories pc on pc.id = c.parent_id
order by p.name;

-- GATE AUTOMÁTICO esperado antes de cutover:
-- products_with_legacy_brand_but_no_brand_id = 0 (salvo excepciones aprobadas)
-- products_with_legacy_category_but_no_category_id = 0 (salvo excepciones aprobadas)
-- orphan_brand_refs = 0
-- orphan_category_refs = 0
-- duplicate reports = 0
-- direct_self_cycles = 0
