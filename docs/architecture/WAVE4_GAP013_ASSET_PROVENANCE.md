# LIHEN WAVE 4 — GAP-013
## Asset Provenance — REUSE + EXTEND V1

**Recovery point de entrada:** `a708c9f4085c5ee64f853f4e6e05216dfb2d9f42`
**GAP:** GAP-013 — Asset Provenance
**Roadmap action:** REUSE + EXTEND
**DB migration in V1:** 0
**RLS changes in V1:** 0
**RPC changes in V1:** 0
**UI changes in V1:** 0
**PROD changes:** 0

## Auditoría real

DEV ya contiene `lihen_private.product_image_sources` como foundation rica de
provenance/evidence y `public.product_images.source_id` posee FK
`ON DELETE RESTRICT` hacia esa tabla.

La source foundation conserva, entre otros: product_id, source_type,
source_reference_id, source_document_key, source_page, source_url,
supplier_reference, brand_id, captured_at, sha256, MIME, dimensiones,
byte_size, quality/confidence, exact-product match, review,
publication eligibility, availability y change detection.

No se crea una segunda tabla, repository, RPC, storage o source-of-truth.

## Decisión V1

Formalizar el contrato de provenance en `@lihen/products` y reutilizar el
`sourceId` ya presente en ProductImage/Product Asset.

Se incorpora `ProductAssetProvenance` como representación de dominio de la
evidencia/origen ya existente y `assertProductAssetProvenanceLink()` protege:
- mismo Product Master;
- asset con sourceId;
- sourceId coincidente con provenance.id.

También se alinea `SUPPLIER_DRIVE`, ya admitido físicamente por DEV, con el
tipo operacional de ProductImage y con las reglas de media existentes.

## Invariantes

- sha256: 64 caracteres hex lowercase;
- page/dimensiones/byte_size positivos cuando existen;
- quality/confidence dentro de 0..100;
- HUMAN_APPROVED requiere exact-product match y requires_review=false;
- supplier evidence no se convierte automáticamente en autoridad canónica;
- provenance/evidence no equivale a selección de canal.

## Fronteras

GAP-013 NO implementa PDF_SELECTED, WEB_SELECTED ni policy de selección.
Eso permanece en GAP-014.

GAP-013 NO agrega variant_id a product_images ni define bridge asset↔variant.

GAP-013 NO crea persistencia paralela. La persistencia existente permanece
`lihen_private.product_image_sources` enlazada desde `public.product_images.source_id`.

## Alcance negativo

0 SQL, 0 migrations, 0 RLS, 0 RPC, 0 UI, 0 PROD, 0 publishing y 0 liberación
de execution/canary/release gates.
