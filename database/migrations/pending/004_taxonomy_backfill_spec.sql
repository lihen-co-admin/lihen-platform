-- FASE 1.8.1 — SPEC / NO EJECUTAR HASTA COMPLETAR LOS MAPAS DEV
-- Este archivo describe el backfill. NO contiene mappings inventados.
-- Las tablas migration.* se usan como staging revisable.

begin;

create schema if not exists migration;

create table if not exists migration.brand_map (
  legacy_brand text primary key,
  normalized_legacy_brand text not null,
  canonical_name text not null,
  canonical_normalized_name text not null,
  decision text not null,
  notes text null,
  reviewed_at timestamptz null,
  constraint migration_brand_map_decision_valid
    check (decision in ('EXACT','MERGE_APPROVED','UNMAPPED','IGNORE'))
);

create table if not exists migration.category_map (
  business_line text null,
  legacy_category text null,
  legacy_subcategory text null,
  canonical_parent_name text null,
  canonical_name text not null,
  decision text not null,
  notes text null,
  reviewed_at timestamptz null,
  constraint migration_category_map_decision_valid
    check (decision in ('EXACT','MERGE_APPROVED','UNMAPPED','IGNORE'))
);

-- STOP CONDITION: no aplicar inserts/backfill si queda UNMAPPED.
do $$
begin
  if exists (select 1 from migration.brand_map where decision = 'UNMAPPED') then
    raise exception 'TAXONOMY_BACKFILL_BLOCKED: brand_map contains UNMAPPED rows';
  end if;
  if exists (select 1 from migration.category_map where decision = 'UNMAPPED') then
    raise exception 'TAXONOMY_BACKFILL_BLOCKED: category_map contains UNMAPPED rows';
  end if;
end $$;

-- Los INSERT a brands/categories y UPDATE products.brand_id/category_id
-- se materializarán únicamente después de cargar y revisar los mapas reales de DEV.

rollback;
