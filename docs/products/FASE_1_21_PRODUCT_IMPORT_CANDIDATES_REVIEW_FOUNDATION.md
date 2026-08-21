# FASE 1.21 — Product Import Candidates & Review Foundation

## Authority boundary
A catalog reference may become a **candidate**, but a candidate is not a canonical `products` row.

## Snapshot result
- 1,003 catalog references assessed.
- 877 references resolved to a real DEV `brand_id`.
- 126 generic/accessory references resolved to a real DEV `category_id`.
- 1,003/1,003 have at least one canonical taxonomy anchor.
- 816 `READY_CANDIDATE`.
- 74 `CONFLICT` because the catalog identity is duplicated and requires disambiguation.
- 113 `REVIEW_REQUIRED` because the canonical catalog audit already marked them for review.
- 0 candidates are allowed to auto-insert.
- 0 rows are written to `public.products` in this phase.

## Identity rules
SKU and catalog code remain preferred identifiers when they become available. A brand/category UUID gives taxonomy context; it does not by itself prove product identity. Supplier evidence and image SHA-256 remain auxiliary evidence only.

## Category rule
Only the five explicit canonical catalog sections are assigned a `category_id`. No category is inferred from product wording.

## Review outcomes
Future human review can `APPROVE_CREATE`, `LINK_EXISTING_PRODUCT`, `REJECT`, or `DEFER`. A later controlled backfill/cutover is required to create canonical products.
