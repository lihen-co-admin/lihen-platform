# TANDA 1 — archivos intencionales de cierre

Este documento sirve como guía de staging. No usar `git add .`.

## Foundation / Control Center
- `.env.example`
- `apps/control-center/.env.example`
- `apps/control-center/src/components/AppShell.tsx`
- `apps/control-center/src/components/AdminPageHero.tsx`
- `apps/control-center/src/components/IntelligencePanel.tsx`
- `apps/control-center/src/components/OperationalNotice.tsx`
- `apps/control-center/src/components/SummaryStrip.tsx`
- `apps/control-center/src/composition/operations.ts`
- `apps/control-center/src/pages/BrandsPage.tsx`
- `apps/control-center/src/pages/CatalogsPage.tsx`
- `apps/control-center/src/pages/CategoriesPage.tsx`
- `apps/control-center/src/pages/DashboardPage.tsx`
- `apps/control-center/src/pages/DevAuthProbePage.tsx`
- `apps/control-center/src/pages/FinancePage.tsx`
- `apps/control-center/src/pages/InventoryPage.tsx`
- `apps/control-center/src/pages/OperationsPage.tsx`
- `apps/control-center/src/pages/OrdersPage.tsx`
- `apps/control-center/src/pages/ProductsPage.tsx`
- `apps/control-center/src/pages/PublicHubPage.tsx`
- `apps/control-center/src/pages/PurchasesPage.tsx`
- `apps/control-center/src/pages/SalesPage.tsx`
- `apps/control-center/src/pages/SuppliersPage.tsx`
- `apps/control-center/src/styles/app.css`
- `apps/control-center/src/styles/tokens.css`
- `tests/architecture/boundaries.test.ts`

## Archivos que ya estaban relacionados con la continuidad de Lens / media
`apps/control-center/src/composition/visual-intelligence.ts` y `apps/control-center/src/pages/ProductImagesPage.tsx` aparecen modificados en el working tree, pero deben incluirse en un commit solo si se confirma que forman parte del corte acumulado que se quiere preservar. No mezclarlos a ciegas con auxiliares históricos.

## Migraciones nuevas del baseline/foundation
- `database/migrations/20260827013000_tanda1_short_release_authorization_guard_rpc.sql`
- `database/migrations/20260827023000_truth_baseline_phase87_short_rpc_alias.sql`

## Documentación
- `docs/LIHEN_TRUTH_ARCHITECTURE_BASELINE_2026-08-27.md`
- `docs/TANDA1_LIHEN_ADMIN_FOUNDATION_CUT1_2026-08-27.md`
- `docs/TANDA1_LIHEN_ADMIN_FOUNDATION_CUT2_2026-08-27.md`
- `docs/TANDA1_LIHEN_ADMIN_FOUNDATION_CUT3_2026-08-27.md`
- `docs/TANDA1_LIHEN_ADMIN_FOUNDATION_CUT4_2026-08-27.md`
- `docs/TANDA1_LIHEN_ADMIN_FOUNDATION_CUT5_2026-08-27.md`
- `docs/TANDA1_LIHEN_ADMIN_FOUNDATION_CUT6_2026-08-27.md`
- `docs/TANDA1_LIHEN_ADMIN_FOUNDATION_CLOSURE_2026-08-27.md`
- `docs/TANDA1_LIHEN_ADMIN_FOUNDATION_INTENDED_FILES_2026-08-27.md`

## No staging accidental
- `apps/control-center/tsconfig.app.tsbuildinfo`
- `apps/storefront/tsconfig.tsbuildinfo`
- auxiliares ZIP / patch / README_COPIAR_Y_PEGAR históricos
- CSV históricos y migraciones antiguas que no correspondan expresamente al cierre actual
