# FASE 1.18 — Catalog Image Reconciliation & Orchestration Foundation

## Objective
Connect catalog V1 image evidence to the stable LIHEN `product_id` without treating PDF crops as canonical originals and without inventing product identities.

## DEV baseline
At execution time DEV contains zero products, brands, categories, product images, and Storage objects. Therefore every one of the 1,003 catalog evidences is intentionally `UNRESOLVED_PRODUCT`.

## Authority rules
1. The canonical commercial source is `CATALOGO_LIHEN_V5_ACTL_V1.pdf`.
2. A crop extracted from the PDF is evidence for reconciliation, not an ORIGINAL Storage asset.
3. `product_id` is never generated from page, slot, product name, image hash, or filename.
4. Automatic matching is allowed only when one and only one real Product Master row has the exact normalized product name AND exact normalized brand.
5. Exact name without confirmed brand is review-only.
6. Fuzzy/semantic similarity can be added later as a recommendation signal but can never auto-approve a match.
7. Duplicate candidates are always ambiguous.
8. Evidence marked REVIEW by FASE 1.16.1 remains human-review gated even if identity signals match.
9. A human APPROVE_MATCH decision is append-only evidence. It does not itself create `product_images` or upload files.

## Model
Private metadata tables:
- `catalog_image_evidence_sources`
- `catalog_image_evidence`
- `catalog_image_reconciliation_runs`
- `catalog_image_reconciliation_results`
- `catalog_image_reconciliation_decisions`

No direct grants are given to `anon` or `authenticated`.

## Orchestration sequence
`CATALOG SNAPSHOT → EVIDENCE → PRODUCT MASTER MATCH → REVIEW → APPROVED PRODUCT_ID → FUTURE IMAGE SOURCE SELECTION → FUTURE STORAGE UPLOAD → FUTURE PRODUCT_IMAGE METADATA`

## Not done in this phase
- No catalog evidence imported into Supabase.
- No Storage object uploaded.
- No `product_images` row created.
- No product created.
- No RLS/write cutover enabled.
- No crop promoted to ORIGINAL.
