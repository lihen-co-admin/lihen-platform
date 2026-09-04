# WAVE 7 / GAP-026 — STYLE Editorial Policy

## Classification

REUSE + FORMALIZE / DELTA-FIRST.

The STYLE foundation already existed: editorial templates, visual identity, face
policy, category covers, product visual preparation and a DEV-only commercial
preview. GAP-026 does not rebuild those foundations. It formalizes their authority
boundary and retires the temporary legacy STYLE adapter left by GAP-024.

## Core policy

A STYLE editorial asset is a presentation concern, not a canonical Product Asset.

The renderer receives the already-resolved `CatalogRenderProductSnapshot` from
Catalog Render Model VNext. Editorial preparation may crop/reframe/clean background
for layout purposes, but it:

- does not mutate Product Assets;
- does not replace `selectedPdfAsset`;
- does not acquire canonical asset authority;
- does not select a different canonical asset;
- does not persist or publish anything.

The editorial projection records the source Product/PDF asset provenance so the
presentation remains traceable.

## Production path

`CatalogRenderModelVNext`
→ STYLE editorial policy
→ STYLE templates / sheets
→ renderer

`CatalogRenderEntry` is no longer the production STYLE rendering contract.
The GAP-024 `toLegacyStyleRenderEntry()` compatibility adapter is retired.

## DEV preview

The existing STYLE commercial preview remains `DEV_ONLY`,
`publicationAllowed: false` and `snapshotMutationAllowed: false`.

Its local fixtures now emit `CatalogRenderProductSnapshot`-shaped presentation
snapshots explicitly marked with `LEGACY_RENDER_PROJECTION`. They do not create
canonical Product Assets and cannot publish.

## Out of scope

No SQL, migrations, RLS, RPC, Supabase writes, Product Master mutation, Pricing
changes, publishing, PROD mutation or CSS redesign are part of GAP-026.
Historical BEAUTY CARE logo work and historical PDF CSS work remain outside this GAP.
