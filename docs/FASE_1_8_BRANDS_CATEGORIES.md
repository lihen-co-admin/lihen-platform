# FASE 1.8 — Brands + Categories / Read & Domain Normalization Slice

## Objetivo
Introducir `Brand` y `Category` como referencias canónicas del dominio de Products sin eliminar todavía los textos legacy `brand`, `category`, `subcategory` ni escribir `brand_id/category_id` en Supabase DEV.

## Implementado
- `Brand` y `Category`.
- `BrandRepository` / `CategoryRepository`.
- `InMemoryBrandRepository` / `InMemoryCategoryRepository`.
- `GetBrands` / `GetCategories`.
- `Product.brandId` / `Product.categoryId` opcionales.
- Resolución de nombres canónicos en `GetProducts` y `GetProductById`.
- Validación de referencias canónicas en `CreateProduct` y `UpdateProduct`.
- Páginas `/brands` y `/categories` de solo lectura.
- Selectores de marca/categoría en create/update en modo memory.
- `LegacyTaxonomyCandidateMapper` para preparar matching sin crear IDs ni escribir DB.
- `004_brands_categories_dev_precheck.sql` de solo lectura.

## Compatibilidad
`SupabaseProductRepository` conserva el contrato de lectura de seis campos (`id, sku, catalog_code, name, status, sale_price`). En FASE 1.8 NO empieza a solicitar `brand`, `category`, `subcategory`, `brand_id` ni `category_id` porque FASE 1.2.1 sigue pendiente contra DEV real.

En fuente `supabase`, la taxonomía canónica queda vacía y la UI muestra `Pendiente normalización`. Esto evita convertir automáticamente texto legacy en referencias canónicas sin mapping aprobado.

## Regla de migración futura
1. Inventariar textos legacy en DEV.
2. Normalizar candidatos sin modificar textos visibles.
3. Revisar colisiones y equivalencias humanas.
4. Crear/backfill `brands` y `categories` mediante migraciones no destructivas.
5. Añadir/backfill `products.brand_id/category_id`.
6. Validar 100% mappings y RLS.
7. Solo entonces evolucionar el Supabase read adapter.

## Supabase writes
Continúan bloqueados. Esta fase no contiene INSERT/UPDATE/UPSERT/DELETE sobre Supabase.
