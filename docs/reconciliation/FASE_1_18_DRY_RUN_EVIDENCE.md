# FASE 1.18 DEV dry-run evidence

Expected baseline at this phase:

- Canonical catalog evidences: 1,003
- Product Master rows: 0
- Expected reconciliation outcome: 1,003 `UNRESOLVED_PRODUCT`
- Storage uploads: 0
- Product image metadata writes: 0

The local manifest is `data/catalog-v1/catalog-image-reconciliation-manifest.json`.
The compact counters are in `data/catalog-v1/catalog-image-reconciliation-dry-run-summary.json`.

## Duplicate evidence signal
The dry-run found 1 duplicate SHA-256 group across 2 catalog rows:
- `CATV1-P163-R3L` — POLVO MAJIKAL
- `CATV1-P164-R3L` — POLVO MAJIKAL MINI

Both evidence crops have the same SHA-256. Therefore image hash is useful for duplicate detection but is explicitly forbidden as automatic Product identity.

## Remote DEV verification
Supabase DEV migration registered as:
`20260821161354 catalog_image_reconciliation_foundation`

Post-migration counts:
- products: 0
- product_images: 0
- Storage objects in LIHEN product buckets: 0
- evidence sources imported: 0
- evidence rows imported: 0
- reconciliation runs/results/decisions: 0

No grants were found for `anon`, `authenticated`, or `PUBLIC` on the five private reconciliation tables.
