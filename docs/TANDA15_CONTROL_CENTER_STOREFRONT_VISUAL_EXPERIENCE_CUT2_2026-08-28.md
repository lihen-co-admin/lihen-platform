# TANDA 15 — Control Center + Storefront Visual & Experience Refinement
## CUT 2 — First real visual refinement
Fecha: 2026-08-28

## Baseline
CUT 1 passed:
- 98/98 test files
- 403/403 tests
- 16/16 architecture
- 403/403 traceability
- typecheck PASS
- lint PASS
- build PASS

The visual source capture supplied 25 exact files from the user's local canonical
worktree. CUT 2 modifies only five CSS files from that capture.

## Control Center
Refinement focuses on:
- clearer sidebar hierarchy and active-state legibility;
- more deliberate LIHEN cream/brown/gold/rose visual language;
- topbar depth and DEV-state visibility;
- page-hero hierarchy;
- summary-card density;
- card/table/form consistency;
- stronger keyboard focus;
- improved tablet/mobile stacking.

No TS/TSX business or navigation logic is changed.

## Storefront
Refinement focuses on:
- warmer LIHEN editorial surface treatment;
- clearer sticky header and mega-menu elevation;
- home hero hierarchy;
- brand/campaign/style section depth;
- catalog card consistency;
- filter surface clarity;
- product-detail gallery/content separation;
- selection drawer depth;
- reduced-motion preservation.

No catalog data, prices, filtering behavior, selection logic or navigation behavior
is changed.

## Safety
- CSS-only application changes.
- No `.env`.
- No Supabase.
- No migration.
- No business/domain logic.
- No governance changes.
- Supplier browser write remains held.
- No dispatch/canary/final release.
- No PROD.

## Validation
Run the canonical `pnpm check` quality gate after extraction.

Because this is visual work, also open the Control Center and Storefront locally
after the automated gate passes and inspect desktop + narrow/mobile widths before
closure.
