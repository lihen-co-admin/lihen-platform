# TANDA 2 — Product Master Completion · intended files

Este manifiesto existe para evitar mezclar cambios históricos no relacionados al preparar el commit.

## Archivos propios de TANDA 2

- `apps/control-center/src/pages/ProductsPage.tsx`
- `apps/control-center/src/pages/ProductDetailPage.tsx`
- `apps/control-center/src/pages/CreateProductPage.tsx`
- `apps/control-center/src/pages/UpdateProductPage.tsx`
- `apps/control-center/src/pages/ChangeProductSalePricePage.tsx`
- `apps/control-center/src/pages/ProductImagesPage.tsx`
- `packages/products/src/domain/product-master-readiness.ts`
- `packages/products/src/index.ts`
- `packages/products/tests/product-master-readiness.test.ts`
- `docs/TANDA2_PRODUCT_MASTER_COMPLETION_CUT1_2026-08-27.md`
- `docs/TANDA2_PRODUCT_MASTER_COMPLETION_CUT2_2026-08-27.md`
- `docs/TANDA2_PRODUCT_MASTER_COMPLETION_CUT3_2026-08-27.md`
- `docs/TANDA2_PRODUCT_MASTER_COMPLETION_CUT4_CLOSURE_2026-08-27.md`
- `docs/TANDA2_PRODUCT_MASTER_COMPLETION_INTENDED_FILES_2026-08-27.md`

## No incluir por accidente

- `apps/control-center/tsconfig.app.tsbuildinfo`
- `apps/storefront/tsconfig.tsbuildinfo`
- CSV históricos de `data/catalog-v1/` que no pertenecen a esta tanda
- migraciones históricas Lens Mode modificadas antes de esta tanda
- ZIP, patches, toolkits y README auxiliares históricos no relacionados

No usar `git add .`.
