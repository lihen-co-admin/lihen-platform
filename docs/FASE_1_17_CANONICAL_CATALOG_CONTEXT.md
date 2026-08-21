# FASE 1.17 — Canonical Catalog Context

Storage architecture is designed after FASE 1.16.1 audited the customer-facing catalog `CATALOGO_LIHEN_V5_ACTL_V1.pdf`.

Audit baseline:

- 245 PDF pages.
- 1,003 detected product cards.
- 1,003 image-evidence SHA-256 hashes.
- Those PDF card crops are reconciliation evidence; they are **not** automatically promoted to canonical Storage originals.
- Final visible customer price remains the public catalog authority during reconciliation.

Storage therefore preserves originals and derivatives separately, so future product-image reconciliation can compare evidence without destroying or overwriting source assets.
