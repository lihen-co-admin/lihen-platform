# MULTICHANNEL-01/02 — Content Workspace

Control Center routes: `/content/social` and `/conversations`; Dashboard links to the editorial workspace.

## Editorial operations

- `ContentSchedule`, `PreparedPublication` and their existing review handlers remain the editorial contracts. New content starts as `PREPARED`; an optional schedule starts as `DRAFT`. Human review, approval and scheduling are separate steps.
- Authenticated OWNER/ADMIN users read the shared editorial library through `READ_EDITORIAL_WORKSPACE` in `marketing-social-runtime`. Saves use the existing `SAVE_CONTENT_SCHEDULE` and `SAVE_PREPARED_PUBLICATION` actions. The calendar, library, status counts and “Hoy en LIHEN” use the returned DEV records. Local storage holds only personal planner goals.
- The read action selects editorial fields from schedules, prepared publications and attempts. It does not write, create attempts, invoke Meta or run publication logic. It follows the existing bearer/profile check; no RLS policy or migration was added.
- Product Master and product media use their existing compositions. A product association is reconstructed only where a selected product image ID is present in the persisted creative asset references; campaign labels are not part of the durable marketing contract.
- The planner compares the observed schedule with local weekly/channel/product/campaign goals. Recommendations are deterministic and require a human decision; they do not approve, schedule or publish.

## Channel and Conversation boundaries

Instagram Feed, Instagram Story and Facebook may be prepared with the existing image runtime; this workspace does not execute publication. Reel/video and TikTok publication integrations remain pending. WhatsApp stays in Conversation, and SEND remains blocked. Suggested replies and follow-ups are explicitly session-only until durable contracts exist.

The Conversation view reads existing Conversation tables with the authenticated browser client and existing RLS. Reply preparation/review is local to the session and has no send path. The official WhatsApp number ending in 4163 is not managed here.

## Verification and governance

The controlled DEV persistence test confirmed draft → review → approval → scheduling. The operator observed the seven-day scheduled count increase from four to five, with zero publication attempts for the test item. No external publication occurred.

No migration was required. The read action is deployed to DEV; see [MULTICHANNEL-02-DURABLE-DEV.md](MULTICHANNEL-02-DURABLE-DEV.md) for its version and verification evidence. PROD remains on hold.
