# Migration Manifest

| Migration | Status | DEV | STAGING | PROD | Notes |
|---|---|---:|---:|---:|---|
| `20260821032919_product_core_base_foundation` | DEV_APPLIED | ✓ | — | — | Product Core base + SELECT-only authenticated RLS. |
| `create_brands_expand` | DEV_APPLIED | ✓ | — | — | Canonical brands, empty, read-only. |
| `create_categories_expand` | DEV_APPLIED | ✓ | — | — | Canonical hierarchical categories, empty, read-only. |
| `add_product_taxonomy_refs_expand` | DEV_APPLIED | ✓ | — | — | Nullable `brand_id/category_id`; legacy text preserved. |
| `validate_product_taxonomy_fks_empty_baseline` | DEV_APPLIED | ✓ | — | — | FK validation safe because DEV product baseline had 0 rows. |
| taxonomy backfill | BLOCKED_NO_SOURCE_DATA | — | — | — | No legacy products exist yet in DEV; no mappings invented. |

No migration in this phase was applied to `lihen-inauguracion`, staging, or production.
