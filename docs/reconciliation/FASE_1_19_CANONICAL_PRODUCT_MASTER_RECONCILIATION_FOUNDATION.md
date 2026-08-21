# FASE 1.19 — Canonical Product Master Reconciliation Foundation

## Purpose
Prepare deterministic reconciliation before any Product Master import.

## Current DEV reality
- `products = 0`
- `brands = 0`
- `categories = 0`
- No product insert/update is performed.

## Catalog V1 dry run
- Catalog references: **1003**
- `NEW_PRODUCT`: **816**
- `CONFLICT`: **74**
- `REVIEW_REQUIRED`: **113**
- `MATCHED`: **0**
- `POSSIBLE_MATCH`: **0** (no Product Master exists yet)

`NEW_PRODUCT` means *candidate against the currently empty DEV master*, not authorization to insert.

## Auxiliary intelligence evidence
`lihen_intelligence` contains **1275 supplier/catalog references**. These are never canonical products.

Exact conservative lookup against Catalog V1:
```json
{
  "SUPPLIER_NAME_ONLY": 182,
  "NO_SUPPLIER_EXACT": 800,
  "SUPPLIER_AMBIGUOUS_NAME_ONLY": 20,
  "SUPPLIER_EXACT_NAME_BRAND": 1
}
```

## Matching authority
1. Trusted existing `product_id`.
2. Unique exact SKU.
3. Unique exact `catalog_code`.
4. Unique normalized exact `name + brand`.
5. Unique exact normalized name => `POSSIBLE_MATCH`, never automatic match.
6. Category, image hash and supplier evidence only strengthen/reject candidates; they do not establish identity alone.

## Conflict policy
- contradictory SKU/catalog code => `CONFLICT`;
- duplicate SKU/catalog code => `CONFLICT`;
- duplicate catalog identity (`name + brand`) => `CONFLICT` until variants/identifiers disambiguate;
- source audit issue => `REVIEW_REQUIRED`;
- fuzzy similarity may be added later only to rank candidates.

## Safety
No Product Master, taxonomy, ProductImage, Storage or pricing write is enabled by this phase.
