# WAVE 7 / GAP-025 — Render Integrity Guard

## Classification

REUSE + FORMALIZE.

The existing PDF renderer already blocked printing while required assets were pending,
when any product/institutional asset failed, and during STYLE DEV preview. GAP-025
formalizes that behavior as a pure, testable read-model guard instead of rebuilding it.

## Scope

- Extract render-integrity evaluation from `CatalogPdfRenderPage.tsx`.
- Preserve the existing counters and event-driven loading behavior.
- Preserve fail-closed printing behavior.
- Preserve STYLE DEV preview as non-printable.
- Preserve renderer responsibility for the explicit `window.print()` user action.
- Keep GAP-026 STYLE Editorial Policy separate.

## Invariants

Printing is allowed only when:

1. STYLE DEV preview is not active.
2. At least one product image is expected.
3. Every expected product image has been processed.
4. Every expected institutional/QR asset has been processed.
5. No product image failed.
6. No institutional/QR asset failed.

Counters are non-negative integers. Invalid counter input fails closed by throwing.

## Boundaries

The guard:

- does not select Product or Brand Assets;
- does not compose Catalog Render Model;
- does not perform page grouping or price formatting;
- does not call Supabase or RPC;
- does not persist or publish;
- does not execute `window.print()`;
- does not define STYLE editorial policy.

## Worktree preservation

GAP-025 is applied against the captured local renderer baseline at recovery point
`fd9604c847d30186b8e1e410e27b6dcb45ebb4ee`.

The applicator verifies the exact SHA-256 of the local renderer before modifying it.
`catalog-pdf-print.css`, historical CatalogBeautyBrandLogo work, tsbuildinfo files and
CUT/TANDA assets remain outside GAP-025.
