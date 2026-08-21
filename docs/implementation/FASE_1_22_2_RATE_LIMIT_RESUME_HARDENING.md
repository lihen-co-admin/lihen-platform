# FASE 1.22.2 — Rate-limit resume hardening

Date: 2026-08-21

The first real DEV cutover authenticated correctly but was throttled by Supabase with HTTP 429 / `too_many_connections` after 887 metadata finalizations. Live reconciliation showed:

- 952 canonical products
- 887 ACTIVE WEB_CARD product_images
- 887 ACTIVE WEB_CARD storage assets
- 887 cutover operations
- 929 physical objects in `lihen-product-web`
- 0 visible products
- 0 legacy `main_image_url` values

The cutover runner was hardened without weakening integrity checks:

- default concurrency reduced from 8 to 2
- retry with exponential backoff and jitter for HTTP 408/425/429/5xx
- public object verification retries transient throttling
- metadata finalization retries transient throttling
- preflight reads already-finalized WEB_CARD metadata and skips those rows
- existing deterministic Storage objects are accepted only after exact size + SHA-256 verification
- final gate still requires exactly 952 canonical ACTIVE WEB_CARD metadata rows
- no `visible_on_website` or `main_image_url` mutation

This change is designed for safe idempotent resume, not destructive replay.
