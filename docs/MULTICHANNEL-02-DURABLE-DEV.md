# MULTICHANNEL-02 — durable editorial workspace in DEV

## Persisted contracts

The Control Center reads `marketing_content_schedules`, `marketing_prepared_publications` and `marketing_publication_attempts` through the `READ_EDITORIAL_WORKSPACE` action in `marketing-social-runtime`. The action requires a valid bearer session and an `ACTIVE` OWNER/ADMIN profile, and returns only fields required for editorial items, calendar state and attempt history. The runtime uses its existing server-side database client; no service-role credential is sent to the browser. No table policy or migration was added.

Editorial writes continue through the existing `SAVE_CONTENT_SCHEDULE` and `SAVE_PREPARED_PUBLICATION` actions/RPCs. The flow preserves DRAFT/PREPARED, review, human approval and schedule states. Saving or programming does not create a `PublicationAttempt` or execute publication.

## Product and media relationships

Product selection uses the existing Product Master composition and authenticated Supabase browser client. Product images are read through the existing `get_product_images` boundary when enabled. The current marketing contracts persist media IDs, but not a separate product ID or campaign name; the workspace associates a product only when a creative asset ID matches authorized product media.

## DEV deployment and controlled verification

- Project: `vnmkupzptujtywnnabkp`.
- Edge Function: `marketing-social-runtime`, ACTIVE version 29, JWT verification enabled.
- `READ_EDITORIAL_WORKSPACE` is read-only: it selects schedules, prepared publications and attempts. Its branch contains no write RPC, attempt creation, scheduler call, Meta request or publishing action.
- The controlled operator test completed create → save → review → approval → scheduling. “Programados · 7 días” increased from four to five after refresh. The test item had zero publication attempts; there was no external publication.
- No schema migration was applied. No scheduler was activated. PROD remains on hold.

TikTok/Reel remain editorial preparation only, with external publication pending. WhatsApp remains in Conversation with SEND blocked. Suggested replies and follow-ups are session-only and are not presented as durable records.
