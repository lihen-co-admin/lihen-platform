# WAVE 7 / GAP-022 — Catalog Render Model VNext

## Status of this package

Implementation candidate V1 for local validation.

Recovery point required:

`402763b2b1ba9fe21d926e764ab6c8a96a7ce2f0`

## Delta-first audit

The continuity document authorizes WAVE 7 / GAP-022 after WAVE 6 closed PASS.

The repository delta from GAP-014 recovery
`27ac57dc3ec084cca1f2f62957c95cdc97f1db56`
to the current recovery contains seven commits and no catalog/render/composition file
changes. Therefore the already-audited catalog foundation can be reused without
repeating the full CORTE 1/2 audit.

Current facts at the recovery point:

- `@lihen/catalog` exposes CatalogVersion, CatalogEntry, CatalogRepository and
  publication contracts.
- `CatalogEntry` is intentionally small and does not represent the renderer-ready
  shape.
- Control Center `composition/catalogs.ts` currently owns `CatalogRenderEntry`
  and maps `catalog_pdf_render_projection`.
- `CatalogPdfRenderPage.tsx` still filters by line, groups by brand, paginates
  products, switches STYLE templates and consumes `entry.imageUrl` directly.
- GAP-014 already formalized `CATALOG_PDF` as exactly one selected Product Asset.
- GAP-015/016 formalized Brand Asset / Brand Intelligence, while physical Brand
  Asset 1:N persistence is still not available.
- The current renderer and CSS have historical local worktree changes and must
  not be absorbed into GAP-022.

## Classification

**REUSE + EXTEND / CONSOLIDATE**

GAP-022 does not rebuild catalog. It makes the implicit renderer contract explicit
inside `@lihen/catalog`.

## Implemented responsibility

`CatalogRenderModelVNext` is a pure renderer-ready contract containing:

- immutable catalog version snapshot;
- explicit render scope;
- immutable ordered product snapshots;
- frozen sale-price snapshot;
- one already-resolved PDF image snapshot per product;
- explicit asset resolution source;
- resolved brand identity snapshot with explicit visual source;
- optional frozen institutional snapshot;
- deterministic ordering and identity/version invariants.

The contract recognizes migration sources explicitly:

- `CHANNEL_SELECTION` is the target Product Asset path;
- `LEGACY_RENDER_PROJECTION` is compatibility only;
- `CANONICAL_BRAND_ASSET` is the target brand visual path;
- `LEGACY_COMPATIBILITY` is compatibility only;
- `TEXT_ONLY` is valid when no approved visual is available.

Legacy compatibility never becomes canonical authority merely by entering the
Render Model.

## Separation from the next gaps

GAP-022 **does not**:

- query Supabase or call RPC;
- choose Product Assets or Brand Assets;
- build groups/pages;
- filter raw catalog data into a final composition;
- apply STYLE editorial policy;
- format prices;
- render React;
- print/publish;
- implement the Render Integrity Guard.

Ownership remains:

- GAP-023 — Catalog Composer: raw/snapshot inputs → resolved Render Model.
- GAP-024 — PDF Renderer Purification: renderer consumes the resolved model.
- GAP-025 — Render Integrity Guard: formalize publication/print blocking.
- GAP-026 — STYLE Editorial Policy.

## Files

1. `docs/architecture/WAVE7_GAP022_CATALOG_RENDER_MODEL_VNEXT.md`
2. `packages/catalog/src/domain/catalog-render-model-vnext.ts`
3. `packages/catalog/src/index.ts`
4. `packages/catalog/tests/catalog-render-model-vnext.test.ts`
5. `tests/architecture/catalog-render-model-vnext-foundation.test.ts`

## Negative scope

No SQL.
No migrations.
No RLS.
No RPC/API changes.
No Supabase writes.
No Product Master mutation.
No Pricing mutation.
No UI change.
No renderer/CSS change.
No publishing change.
No PROD change.
No execution/canary/release gate change.

## Done criteria

GAP-022 can move to DONE only after:

1. target tests PASS;
2. architecture tests PASS;
3. full `pnpm check` PASS;
4. exact staged scope is verified;
5. commit/push are verified;
6. remote 40-char SHA is confirmed;
7. continuity is updated and read back.
