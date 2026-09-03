# WAVE 7 / GAP-024 — PDF Renderer Purification

## Required recovery

`b21305622776bf2fe433062c3d3d173b166e7dfa`

## Classification

**REUSE + REFACTOR / THIN RENDERER**

Execution mode: **STANDARD** because the renderer contains valid historical
local worktree changes that must be preserved.

## Local-worktree preservation

The implementation package was generated against the user-provided local
renderer baseline, not against a clean hypothetical checkout.

Baseline SHA-256:

`dc64f9fa084ffa47b66436e8063969edee588a875fdec98e1dca39e1cb6db5f8`

The baseline contains the historical `CatalogBeautyBrandLogo` import and
BEAUTY_CARE brand-page rendering. Those changes remain intact.

`catalog-pdf-print.css` has a large historical local delta and is deliberately
untouched.

## Responsibility

GAP-024 moves the renderer from direct legacy projection orchestration toward
the contracts completed in GAP-022 and GAP-023.

A dedicated Control Center composition boundary now:

- loads existing catalog projection + institutional snapshot;
- maps them to `CatalogComposerInput`;
- invokes `composeCatalogRenderModel`;
- returns `CatalogRenderModelVNext`;
- exposes a narrow legacy STYLE adapter only for the deferred GAP-026 policy.

The React renderer now:

- consumes `CatalogRenderModelVNext`;
- no longer calls `catalogsComposition.getRenderEntries` directly;
- no longer performs business-line filtering;
- reads product image from `selectedPdfAsset.publicUrl`;
- reads commercial snapshot from `salePriceSnapshot`;
- reads institutional data from the immutable Render Model.

## Deferred boundaries

GAP-024 intentionally preserves:

- current body-page grouping/pagination as renderer presentation logic;
- current STYLE template pipeline through an explicit legacy adapter;
- current `canPrint` readiness logic.

These are not silently redefined because:

- GAP-025 owns Render Integrity Guard formalization;
- GAP-026 owns STYLE Editorial Policy.

## Dependency

Control Center now declares `@lihen/catalog` as an explicit workspace
dependency. The pnpm importer is updated consistently.

## Negative scope

No SQL.
No migration.
No RLS.
No RPC contract changes.
No Supabase write changes.
No Product Master/Pricing mutation.
No CSS change.
No publishing change.
No PROD change.
No Render Integrity Guard redesign.
No STYLE editorial-policy redesign.

## Files in implementation scope

1. `apps/control-center/package.json`
2. `pnpm-lock.yaml`
3. `apps/control-center/src/composition/catalog-pdf-render-model.ts`
4. `apps/control-center/src/composition/tests/catalog-pdf-render-model.test.ts`
5. `apps/control-center/src/pages/CatalogPdfRenderPage.tsx`
6. `tests/architecture/pdf-renderer-purification-foundation.test.ts`
7. `docs/architecture/WAVE7_GAP024_PDF_RENDERER_PURIFICATION.md`

Historical renderer hunks are preserved in the worktree and must remain
unstaged when GAP-024 is eventually committed.
