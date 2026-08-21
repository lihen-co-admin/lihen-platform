# Taxonomy mapping workspace

Este directorio contiene artefactos de mapeo **revisables y no productivos** usados por la FASE 1.8.1.

No se deben guardar aquí datos personales ni dumps completos de producción.

## Flujo

1. Ejecutar `database/validation/004_brands_categories_dev_precheck.sql` y `005_taxonomy_mapping_quality_precheck.sql` en Supabase DEV.
2. Exportar únicamente los inventarios de taxonomía necesarios.
3. Completar `brand-map.template.csv` y `category-map.template.csv`.
4. Revisar manualmente toda fila marcada `REVIEW` o `UNMAPPED`.
5. El backfill se considera listo solo cuando `UNMAPPED = 0` para todos los productos que requieren taxonomía.

Los IDs canónicos se generan en DEV durante la migración; no se inventan desde el frontend.
