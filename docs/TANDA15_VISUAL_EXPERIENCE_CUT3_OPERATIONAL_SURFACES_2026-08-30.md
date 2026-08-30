# TANDA 15 — Visual & Experience Refinement
## CUT 3 — Operational surfaces, states, forms, accessibility and responsive
Fecha: 2026-08-30

## Recovery baseline
Starts from pushed recovery point:
`3dc49e760dda270cb73ea243de8fbe5c70b9e8bb`

## Scope
CSS-only refinement of remaining high-use operational and storefront surfaces.

### Control Center
- sticky table headers inside horizontal operational tables;
- clearer search/toolbar hierarchy;
- improved form focus, disabled and evidence states;
- more differentiated loading / empty / error / success surfaces;
- calmer intelligence cards;
- responsive toolbar/card/form behavior;
- mobile-safe tables without changing table semantics.

### Storefront
- clearer catalog filters;
- stronger keyboard focus;
- polished empty/error states;
- pagination feedback;
- selection drawer scroll/footer treatment;
- narrow-screen catalog hierarchy;
- mobile navigation touch-target improvements;
- reduced-motion and higher-contrast safeguards.

## Explicit non-goals
- no TS/TSX behavior change;
- no domain/application logic;
- no data contract change;
- no navigation routing change;
- no `.env`;
- no Supabase;
- no migration;
- no write-mode change;
- no governance;
- no PROD.

## Validation
After extraction:
1. `git diff --check`
2. `pnpm check`
3. restore tsbuildinfo
4. `git status --short`
5. visual smoke check: Products/Inventory/Suppliers/Orders + Storefront Catalog mobile.
