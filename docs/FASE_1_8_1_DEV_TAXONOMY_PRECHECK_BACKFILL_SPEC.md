# FASE 1.8.1 — DEV Taxonomy Precheck + Backfill Spec

## Estado

**IMPLEMENTADA COMO GATE + SPEC. EJECUCIÓN DEV REAL PENDIENTE.**

No se ha realizado ningún `INSERT`, `UPDATE`, `ALTER` ni cambio de RLS sobre Supabase DEV/PROD desde este proyecto.

## Objetivo

Normalizar progresivamente:

`products.brand / category / subcategory` → `brands / categories` → `products.brand_id / category_id`

sin romper el contrato legacy ni hacer cutover prematuro.

## Orden obligatorio

1. Ejecutar `004_brands_categories_dev_precheck.sql`.
2. Ejecutar `005_taxonomy_mapping_quality_precheck.sql`.
3. Exportar inventarios de taxonomía DEV y completar mapas revisados.
4. Resolver todas las colisiones y `UNMAPPED`.
5. Aplicar en DEV las migraciones `pending/001..003` con numeración real.
6. Cargar `migration.brand_map` y `migration.category_map` con datos revisados.
7. Materializar el backfill real a partir de esos mapas.
8. Ejecutar `006_taxonomy_backfill_acceptance.sql`.
9. Validar FK/RLS/policies y regresión de `catalog_public`/ADMIN.
10. Solo con cobertura y consistencia aprobadas, preparar el cutover de lectura.

## Política de matching

### Brand

Una marca no se identifica únicamente por `lower(trim(text))` cuando hay colisiones. La normalización se usa para **detectar candidatos**, no para decidir merges dudosos.

Estados de mapeo:
- `EXACT`: unívoco.
- `MERGE_APPROVED`: varias grafías fueron revisadas y aprobadas como una misma marca.
- `UNMAPPED`: bloquea backfill/cutover.
- `IGNORE`: excepción explícita y documentada.

### Category

La identidad se evalúa por ruta/contexto, no por nombre suelto:

`business_line → category → subcategory`

La categoría final de `products.category_id` apunta al nodo más específico aprobado. No se crea `subcategory_id`.

## Reglas no destructivas

- No borrar `products.brand`, `products.category`, `products.subcategory`.
- `brand_id/category_id` nacen nullable.
- No añadir `NOT NULL` en esta fase.
- No activar lectura canónica en `SupabaseProductRepository` todavía.
- No crear `UNIQUE(normalized_name)` hasta resolver colisiones reales.
- No escribir en PROD.

## Gate de aceptación

Antes del cutover DEV:

- 0 referencias huérfanas.
- 0 mappings bloqueantes sin resolver.
- 0 duplicados canónicos no aprobados.
- 0 ciclos directos; la validación de ciclos recursivos debe añadirse antes de jerarquías profundas.
- Cobertura 100 % de productos que deben tener marca/categoría, salvo excepciones documentadas.
- El conteo total de productos no cambia.
- `id`, `sku`, `catalog_code`, `sale_price`, stock, ventas e historial permanecen sin modificación.

## Rollback

Durante la etapa expand/backfill el rollback funcional es simple:

- mantener consumers leyendo textos legacy;
- limpiar `brand_id/category_id` de DEV si un backfill de prueba fuera rechazado;
- conservar `brands/categories` para diagnóstico o retirarlas mediante migración explícita si todavía no tienen consumidores.

Nunca se necesita restaurar `brand/category/subcategory` porque no se eliminan.

## Evidencia de conexión disponible

El Supabase conectado durante esta fase fue inspeccionado en modo de solo lectura y resultó ser `lihen-inauguracion`, sin tabla `public.products` y sin branches DEV. Por ello **no es el target válido** para ejecutar este gate. Véase `docs/FASE_1_8_1_CONNECTED_SUPABASE_EVIDENCE.md`.
