# TANDA 15 — CUT 2 R1 Screenshot-driven corrective
Fecha: 2026-08-30

## Evidence reviewed
Visual inspection covered:
- Control Center Dashboard desktop;
- Products, Inventory, Suppliers and DEV Auth/RLS surfaces;
- Control Center narrow/mobile emulation;
- Storefront Home desktop;
- Storefront brand carousel;
- Storefront narrow/mobile catalog/product carousel.

The automated quality gate before this corrective was already:
- 98/98 test files PASS;
- 403/403 tests PASS;
- 16/16 architecture PASS;
- 403/403 traceability IDENTIFIED;
- typecheck/lint/build PASS.

## Corrections
### Control Center
- Dashboard summary strip uses a balanced five-column layout on wide desktop,
  matching the observed ten-metric dashboard without leaving an oversized empty
  tail on the second row.
- On very narrow screens, the long administrative sidebar is capped to a
  scrollable mobile region so the business content can be reached without
  traversing the entire navigation vertically.

### Storefront
- Corrects the brand fallback-initial treatment. A more generic
  `.home-brand span` rule had higher specificity than `.home-brand__initials`,
  causing initials to render as tiny text at the top of otherwise empty circles.
  R1 restores centered, editorial fallback initials.

## Safety
CSS-only.
No TS/TSX logic.
No domain changes.
No navigation behavior changes.
No `.env`.
No Supabase.
No migration.
No PROD.
All controlled write modes remain unchanged.
