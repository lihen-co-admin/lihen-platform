# FASE 1.8 — Validación

## Gates locales
- Product domain usa IDs canónicos opcionales, no textos de marca/categoría como identidad.
- Repositories de Brand/Category son puertos independientes.
- Los adapters implementados son únicamente in-memory.
- `SupabaseProductRepository` mantiene sus seis columnas previas y ninguna escritura.
- `LegacyTaxonomyCandidateMapper` genera candidatos; nunca crea entidades ni IDs.
- Create/Update validan `brandId/categoryId` cuando están presentes.

## Gate DEV pendiente
Ejecutar `database/validation/004_brands_categories_dev_precheck.sql` sobre Supabase DEV real y revisar:
- columnas legacy;
- tablas `brands/categories` si existieran;
- duplicados/equivalencias;
- estructura y RLS;
- política de backfill.

No habilitar persistencia canónica hasta aprobar ese gate.
