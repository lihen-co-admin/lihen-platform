# TANDA 4 — Commerce · archivos intencionales

CUT 1 agrega o modifica intencionalmente:

- `packages/orders/src/domain/order-commerce-policy.ts`
- `packages/orders/tests/order-commerce-policy.test.ts`
- `packages/orders/src/index.ts`
- `apps/control-center/src/pages/OrdersPage.tsx`
- `apps/control-center/src/pages/SalesPage.tsx`
- `docs/TANDA4_COMMERCE_CUT1_2026-08-27.md`
- `docs/TANDA4_COMMERCE_INTENDED_FILES_2026-08-27.md`

No incluir por este corte archivos `tsbuildinfo`, CSV históricos, ZIP/patch auxiliares ni migraciones antiguas modificadas que no pertenezcan a TANDA 4.

CUT 2 agrega o modifica intencionalmente:

- `apps/control-center/src/domain/commerce-reconciliation.ts`
- `apps/control-center/tests/commerce-reconciliation.test.ts`
- `apps/control-center/src/pages/SalesPage.tsx`
- `packages/sales/src/domain/sale.ts`
- `packages/sales/src/ports/sale-repository.ts`
- `packages/sales/src/infrastructure/supabase-sale-repository.ts`
- `packages/inventory/src/ports/inventory-repository.ts`
- `packages/inventory/src/infrastructure/in-memory-inventory-repository.ts`
- `packages/inventory/src/infrastructure/supabase-inventory-repository.ts`
- `packages/finance/src/ports/finance-repository.ts`
- `packages/finance/src/infrastructure/supabase-finance-repository.ts`
- `docs/TANDA4_COMMERCE_CUT2_2026-08-27.md`

CUT 3 agrega o modifica intencionalmente:

- `apps/control-center/src/domain/order-cancellation-reconciliation.ts`
- `apps/control-center/src/domain/commerce-readiness.ts`
- `apps/control-center/tests/order-cancellation-reconciliation.test.ts`
- `apps/control-center/tests/commerce-readiness.test.ts`
- `apps/control-center/src/pages/SalesPage.tsx`
- `apps/control-center/src/pages/OrdersPage.tsx`
- `packages/sales/src/domain/sale-reversal-policy.ts`
- `packages/sales/tests/sale-reversal-policy.test.ts`
- `packages/sales/src/index.ts`
- `docs/TANDA4_COMMERCE_CUT3_2026-08-27.md`
- `docs/TANDA4_COMMERCE_INTENDED_FILES_2026-08-27.md`

Este corte no agrega migraciones ni habilita un reverso de venta. No incluir `tsbuildinfo`, CSV históricos, ZIP/patch auxiliares ni migraciones antiguas modificadas que no pertenezcan a TANDA 4.

CUT 4 / CLOSURE agrega intencionalmente:

- `docs/TANDA4_COMMERCE_CUT4_CLOSURE_2026-08-27.md`
- actualización de `docs/TANDA4_COMMERCE_INTENDED_FILES_2026-08-27.md`

El cierre no agrega migraciones ni nuevos writes. No incluir `tsbuildinfo`, CSV históricos, ZIP/patch auxiliares ni migraciones antiguas modificadas que no pertenezcan a TANDA 4.

Estado final: **TANDA 4 — Commerce = CLOSED / PASS**.
