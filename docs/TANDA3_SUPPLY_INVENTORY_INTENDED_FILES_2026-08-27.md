# TANDA 3 — Supply & Inventory · archivos intencionales acumulados

Este manifiesto existe para evitar staging accidental de históricos, artefactos auxiliares, CSV de reconciliación previa, ZIPs, patches o `tsbuildinfo`.

## CUT 1

- `apps/control-center/src/pages/PurchaseDetailPage.tsx`
- `apps/control-center/src/pages/InventoryPage.tsx`
- `packages/procurement/src/domain/purchase-supply-readiness.ts`
- `packages/procurement/src/index.ts`
- `packages/procurement/tests/purchase-supply-readiness.test.ts`
- `docs/TANDA3_SUPPLY_INVENTORY_CUT1_2026-08-27.md`

## CUT 2

- `apps/control-center/src/domain/supply-inventory-reconciliation.ts`
- `apps/control-center/tests/supply-inventory-reconciliation.test.ts`
- `apps/control-center/src/pages/PurchaseDetailPage.tsx`
- `apps/control-center/src/pages/SuppliersPage.tsx`
- `docs/TANDA3_SUPPLY_INVENTORY_CUT2_2026-08-27.md`
- `docs/TANDA3_SUPPLY_INVENTORY_INTENDED_FILES_2026-08-27.md`

## No incluir por este corte

- `apps/control-center/tsconfig.app.tsbuildinfo`
- `apps/storefront/tsconfig.tsbuildinfo`
- `data/catalog-v1/*.csv`
- migraciones Lens Mode históricas modificadas por line endings
- ZIPs, patches, toolkits o READMEs auxiliares históricos

Nunca usar `git add .` para este cierre.

## CUT 3

- `packages/inventory/src/domain/inventory-adjustment-policy.ts`
- `packages/inventory/src/application/commands/record-inventory-adjustment.handler.ts`
- `packages/inventory/src/index.ts`
- `packages/inventory/tests/inventory-adjustment-policy.test.ts`
- `apps/control-center/src/domain/supply-inventory-readiness.ts`
- `apps/control-center/tests/supply-inventory-readiness.test.ts`
- `apps/control-center/src/pages/InventoryPage.tsx`
- `docs/TANDA3_SUPPLY_INVENTORY_CUT3_2026-08-27.md`
- `docs/TANDA3_SUPPLY_INVENTORY_INTENDED_FILES_2026-08-27.md`

## CUT 4 / CLOSURE

- `docs/TANDA3_SUPPLY_INVENTORY_CUT4_CLOSURE_2026-08-27.md`
- `docs/TANDA3_SUPPLY_INVENTORY_INTENDED_FILES_2026-08-27.md`

El cierre no agrega lógica de negocio nueva; consolida evidencia QA y Definition of Done después del checkpoint local PASS de CUT 3 FIX 1.
