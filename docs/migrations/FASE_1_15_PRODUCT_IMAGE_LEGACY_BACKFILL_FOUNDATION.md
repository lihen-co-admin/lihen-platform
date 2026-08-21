# FASE 1.15 — Product Image Legacy Backfill Foundation

Status: FOUNDATION READY / REAL BACKFILL NOT EXECUTED.

## Objective
Prepare a non-destructive migration from `products.main_image_url` to canonical `product_images` without changing legacy values and without inserting image rows during this phase.

## Doctrine
`SNAPSHOT → DRY-RUN → CLASSIFY → REVIEW → APPROVE → BACKFILL → COMPARE`.

## Dry-run classifications
- `READY`: no canonical images, unique nonblank legacy URL, safe future automatic candidate.
- `ALREADY_BACKFILLED`: exact legacy row already exists as ACTIVE main with source `LEGACY_MAIN_IMAGE_URL`.
- `REVIEW_EXISTING_IMAGES`: canonical image rows exist but no active main; human review required.
- `CONFLICT_ACTIVE_MAIN`: canonical ACTIVE main already exists.
- `CONFLICT_MATCHING_IMAGE_STATE`: exact URL exists but canonical state/source/main does not match the expected backfill row.
- `CONFLICT_SHARED_LEGACY_URL`: multiple products reference the same legacy URL.
- `SKIP_NO_LEGACY_URL`: nothing to migrate.

Only `READY` is eligible for future automated insertion.

## Non-destructive rules
- FASE 1.15 foundation does not insert/update/delete `product_images`.
- `products.main_image_url` remains untouched even in the pending execution script.
- Storage buckets and Storage writes remain disabled.
- The future execution script aborts if blocking classifications remain.

## Pending execution
`database/migrations/pending/009_execute_product_image_legacy_backfill.sql` is intentionally not applied.
