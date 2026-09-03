# WAVE 7 / GAP-023 — Catalog Composer

## Status of this package

Implementation candidate V1 for local validation.

Required recovery point:

`dff8ee709e4ab47b19c996fb13c57b18e9b044e5`

## Execution classification

- Architectural action: **REUSE + EXTRACT / BUILD COMPOSER**
- Execution mode: **FAST / STANDARD PATH**
- Risk: LOW-MEDIUM
- Strategy: DELTA-FIRST; reuse GAP-022 and the already-audited catalog foundations.

## Delta-first audit

GAP-022 formalized `CatalogRenderModelVNext` inside `@lihen/catalog`.
The current Control Center composition still reads
`catalog_pdf_render_projection` into its own `CatalogRenderEntry`, while
`CatalogPdfRenderPage.tsx` still performs line filtering, page grouping and STYLE
switching.

GAP-023 must not rebuild Catalog Domain or move Supabase access into domain code.
It extracts only the pure transformation boundary needed between already-read
catalog snapshots and `CatalogRenderModelVNext`.

The current renderer/CSS also carry historical local worktree changes and are
intentionally excluded. Their purification belongs to GAP-024.

## Implemented responsibility

`composeCatalogRenderModel()` receives:

- one explicit Catalog Version snapshot;
- an explicit render scope (`ALL`, `BEAUTY_CARE`, `STYLE`);
- source entry snapshots;
- optional institutional snapshot;
- optional already-resolved `CATALOG_PDF` Product Asset per source entry;
- optional already-resolved Brand visual identity.

It then:

1. validates version ownership and source-entry uniqueness;
2. filters entries to the requested business-line scope;
3. maps an upstream resolved PDF asset to `CHANNEL_SELECTION`;
4. otherwise preserves the current projection image only as
   `LEGACY_RENDER_PROJECTION`;
5. maps an upstream canonical Brand Asset to `CANONICAL_BRAND_ASSET`;
6. preserves an explicitly supplied legacy brand visual as
   `LEGACY_COMPATIBILITY`;
7. uses `TEXT_ONLY` when no resolved visual identity is available;
8. delegates final invariants, immutability and deterministic ordering to
   `CatalogRenderModelVNext`;
9. returns lightweight composition counters for audit/readiness visibility.

## Critical boundaries

The Composer does **not** decide which Product Asset or Brand Asset is correct.
A `resolvedPdfAsset` means Channel Asset Selection happened upstream.

The Composer does **not**:

- query Supabase;
- call RPC;
- persist;
- mutate Product Master/Pricing/Assets;
- group or paginate PDF sheets;
- format prices;
- apply STYLE editorial templates/policy;
- implement `canPrint` / Render Integrity Guard;
- render React;
- print;
- publish;
- register catalog artifacts.

Ownership remains:

- GAP-024 — PDF Renderer Purification;
- GAP-025 — Render Integrity Guard formalization;
- GAP-026 — STYLE Editorial Policy.

## Migration rule

Legacy render projection media is tolerated only as explicit compatibility.
It remains tagged `LEGACY_RENDER_PROJECTION` and never becomes
`CHANNEL_SELECTION` merely because the Composer consumed it.

Likewise, legacy brand visuals never become canonical Brand Assets by
composition.

## Files

1. `docs/architecture/WAVE7_GAP023_CATALOG_COMPOSER.md`
2. `packages/catalog/src/application/catalog-composer.ts`
3. `packages/catalog/src/index.ts`
4. `packages/catalog/tests/catalog-composer.test.ts`
5. `tests/architecture/catalog-composer-foundation.test.ts`

## Negative scope

- SQL/migrations: none.
- RLS: none.
- RPC/API: none.
- Supabase writes: none.
- UI: none.
- Renderer/CSS: none.
- Product Master/Pricing: none.
- Publishing: none.
- PROD: none.
- execution/canary/release gates: unchanged.

## Done criteria

GAP-023 moves to DONE only after:

1. target tests PASS;
2. architecture tests PASS;
3. full `pnpm check` PASS;
4. exact staging is verified;
5. commit/push are verified;
6. full remote SHA is independently confirmed;
7. continuity is updated and read back.
