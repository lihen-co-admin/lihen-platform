# LIHEN WAVE 4 — GAP-014
## Channel Asset Selection — REUSE + EXTEND V1

**Recovery point de entrada:** `691d18777de0098e3e67fd3d7e4bdf58ccab80a6`
**GAP:** GAP-014 — Channel Asset Selection
**Roadmap action:** REUSE + EXTEND
**DB migration in V1:** 0
**RLS changes in V1:** 0
**RPC changes in V1:** 0
**UI changes in V1:** 0
**PROD changes:** 0

## Auditoría real

LIHEN ya posee una foundation de media que no debe reemplazarse:

- `ProductImage` / `ProductAsset` modelan los assets operativos.
- `ProductMediaSurface` ya reconoce `WEB_CARD`, `WEB_DETAIL` y `CATALOG_PDF`.
- `evaluateProductMediaSourceReadiness()` clasifica readiness.
- `selectProductMediaSource()` elige técnicamente una fuente por surface.
- `buildProductMediaManifest()` produce una proyección dry-run.

Eso resuelve readiness/source selection, pero no formaliza todavía el contrato
canónico de qué Product Asset queda seleccionado por canal.

## Decisión

GAP-014 es REUSE + EXTEND.

Se agrega un contrato puro `ProductChannelAssetSelection` sobre Product Assets
existentes. No se crea una segunda tabla de imágenes, un segundo repository,
un segundo source-selection engine ni una nueva infraestructura de media.

## Invariantes V1

- `CATALOG_PDF` exige exactamente 1 asset seleccionado.
- `WEB_CARD` admite 0 o 1.
- `WEB_DETAIL` admite 0..N.
- IDs seleccionados no se duplican dentro de un canal.
- Todo asset seleccionado debe existir, pertenecer al mismo `productId` y estar ACTIVE.
- Debe existir una selección `CATALOG_PDF` en el set formalizado.
- No puede existir más de un registro de selección para el mismo canal.
- `isMain` genérico NO determina PDF ni Web.
- La selección de canal no altera provenance ni source authority.

## Separaciones

GAP-014 no reemplaza `product-media-readiness`,
`product-media-source-selection` ni `product-media-manifest`. Esas foundations
siguen resolviendo elegibilidad/readiness/elección técnica de fuente.

GAP-014 tampoco implementa persistencia, comandos, UI, publicación, renderer,
Catalog Composer, Brand Assets ni políticas editoriales STYLE.

La persistencia/control operacional de selecciones sólo deberá modificarse si
una auditoría posterior demuestra que la foundation física existente necesita
extensión. No se inventa en V1.

## Alcance negativo

0 SQL, 0 migrations, 0 RLS, 0 RPC, 0 Supabase, 0 UI, 0 PROD, 0 publishing,
0 renderer changes y 0 liberación de execution/canary/release gates.

## DoD V1

- contrato de dominio;
- invariantes de PDF/Web;
- separación explícita frente a generic main, provenance y source-readiness;
- tests de dominio;
- architecture tests;
- export público de `@lihen/products`;
- `pnpm test:architecture` PASS;
- `pnpm check` PASS;
- staging exacto;
- commit/push verificados;
- continuidad actualizada.
