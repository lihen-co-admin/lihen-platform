# SOCIAL-03 — Instagram Reel Governed Runtime Enablement

## Objective

Enable Instagram Reel inside the existing governed DEV publication flow without accepting browser-provided media URLs or weakening MULTICHANNEL-06 reconciliation controls.

## Durable video boundary

`marketing_editorial_video_assets` stores authorized editorial video metadata associated with a product. Direct authenticated table access is denied. `get_marketing_editorial_video_assets` exposes read-only metadata only to ACTIVE OWNER/ADMIN users.

The foundation does not create a Storage bucket, upload a video, seed an asset, authorize publication, enable the scheduler, or touch PROD.

## Runtime invariants

- `INSTAGRAM_REEL` requires the first persisted `creative_asset_id` to resolve to an ACTIVE authorized editorial video for the selected product.
- Client media URLs are ignored; the provider URL comes only from the durable resolver.
- Reel provider containers use `media_type=REELS` and `video_url`.
- Provider/configuration preflight still occurs before server-controlled START.
- Fresh assessment and explicit confirmation are revalidated before execution.
- SUCCEEDED, FAILED, CANCELLED and uncertain IN_PROGRESS attempts are never reused automatically.
- Facebook, Instagram Feed and Instagram Story retain their existing product-image boundary.
- TikTok remains unavailable. WhatsApp SEND and automatic scheduler remain disabled. PROD remains HOLD.

## Activation boundary

The migration and Edge Function changes must be reviewed and applied to DEV before remote Reel capability is considered available. `META_PUBLICATION_ENABLED=false` remains the safe validation posture until a separately authorized real publication test.
