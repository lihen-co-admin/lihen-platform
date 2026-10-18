# Control Center DEV: verified operational increment, 2026-10-18

Only project `vnmkupzptujtywnnabkp`. Previous candidate tree:
`5e67aa94538fa113f19f37d77f2b7e10c4bab6a4`. No changes to the original repository,
its editorial work, branches, existing photographs, workflows or dependencies.

## Hosted synthetic trial: stopped, cleaned, not successful

The temporary localhost coordinator crashed on its first HTTP request because a project URL
constant shadowed the URL constructor. The local helper now uses globalThis.URL. Two successive
HTTP 200 checks proved it was listening before the owner signed in. This helper is outside the
Git candidate and was not published in Control Center.

The owner authenticated directly against DEV in an ephemeral browser SDK session, approved the
displayed synthetic resource and obtained authenticated 503 EXTERNAL_IMAGE_INGESTION_NOT_ACTIVATED.
Administrative provisioning used a separate server client; no browser cookies/tokens were extracted.

Authorized synthetic resources were then provisioned with 20-minute expiry. Only the synthetic flag
was enabled. The first INGEST_SYNTHETIC_TEST_IMAGE returned HTTP 500 LIHEN_INTELLIGENCE_RUNTIME_FAILED.
Sanitized hosted logs identify EXTERNAL_IMAGE_RPC_FAILED:read_synthetic_image_authorization, and
PostgreSQL reports SYNTHETIC_TEST_INVALID. The exact failing predicate has not been established.
The local approval RPC succeeded; a difference in hosted database request context is a hypothesis,
not an established root cause. No authorization condition has been removed or bypassed.

No second ingestion was issued. PNG-to-WebP conversion, derivative readback and idempotence were
NOT demonstrated. Both flags were confirmed absent after finalization. Authorization was revoked,
the exact temporary source objects/bucket, rights, authority and reserved product were removed.
No synthetic receipt remains. The local coordinator was stopped, releasing its administrative
credential held only in memory. No credentials or signed URLs appear in the local result report.

Commercial preservation: before/after fingerprints match for all 1,028 products, 1,142 images,
1,119 provenance sources, 1,141 storage assets, 2,902 catalog entries, seven buckets, 1,522 Storage
objects and 14 Storage policies. The report under .external-image-edge-proof/hosted-trial/result.json
is an execution artifact, excluded from the candidate.

## Product images: useful manual flow, external discovery still blocked

- Existing manual upload/drop/paste, WebP conversion, immutable identity, uncertain-save recovery
  and existing gallery/main photographs are retained. New selections are limited to five queued
  files per operation. The existing ten-image total gallery contract and older retry journals are
  not silently changed; existing galleries are not truncated or deleted.
- Create explains that media associations require confirmed persistence. Update links directly to
  the existing gallery. The gallery offers the requested LIHEN Intelligence action, manual chooser,
  rejection and replacement controls. No secondary upload path or browser HTTPS importer is added.
- Up to five candidates may be displayed with real HTTPS preview, source, dimensions, variant,
  evidence and current validation state. Failed/expired/unverified previews are blocked. Preview
  is not a content hash attestation. Local selection never displays server human approval.
- Product/identity/user changes invalidate candidate scope and pending async results.
- Save/approval remains visibly blocked until durable server authorization is connected. The
  existing default SearchPort provides no photograph/rights contract, and ProductDetail does not
  expose the required manufacturer and official variant/reference binding. Internal SKU/name
  cannot substitute for that evidence. No search provider or commercial image right was invented.
- BC-20869 remains without approved candidates. No browser URL is transferred to the manual queue.

## Existing editorial workspace and Meta

Durable drafts, preview, human review, scheduling/calendar, fresh server assessment and duplicate
prevention already exist. This increment reuses them. Their local regression tests passed; no
new hosted editorial write or public post was performed or claimed as tested here.

marketing-social-runtime v49 is ACTIVE with verify_jwt=true and already includes READ_PROVIDER_READINESS,
READ_EDITORIAL_WORKSPACE and governed CREATE/EXECUTE actions. Required Meta settings are present.
Their presence is not connection verification. Secret metadata fingerprints confirm
MARKETING_SOCIAL_ENVIRONMENT=DEV and META_PUBLICATION_ENABLED=false; no secret values were displayed.
Both external-image flags and TIKTOK_PUBLICATION_ENABLED are absent.

New VERIFY_META_ACCOUNTS is explicit, read-only, DEV-only, behind the existing ACTIVE OWNER/ADMIN
gate. It uses server credentials and fixed Graph HTTPS GET paths to read configured account IDs
and /me/permissions. Requests are bounded, redirects rejected and raw tokens/errors withheld.
An account read and granted scopes are reported separately. Unsupported token scope inspection
fails closed; connection/read access does not imply App Review, business eligibility or publishing
approval. Client fields cannot choose a host, token, account or execution endpoint.

The check supports the existing Facebook Login provider contract, not a new Instagram Login OAuth
system. It must be deployed and exercised before asserting real Meta connectivity. No credential
activation, real Meta call, post, message or comment was performed during local validation.

TikTok is HOLD in UI, policy, creator-info route and both direct/scheduled execution boundaries,
even if configuration is mistakenly enabled later. Provider unit contracts remain intact.
WhatsApp UI remains HOLD; its separate Conversation runtime and credentials were not changed.

Carousel dispatch and Meta inbox/comment management are not implemented by this increment; the
existing publisher's single-image/feed/story and governed Reel contracts remain as implemented.
Those additional operations require their own durable media/message contracts, webhook handling,
permissions and separately approved real acceptance. They are not presented as operational.

## Validation (local, no provider network effects)

- Focused final suite: 173/173 PASS (images, HTTPS/manual regression, editorial drafts/calendar,
  auth gates, Meta read-only verification, explicit TikTok HOLD and existing TikTok provider tests).
- Workspace typecheck: PASS. Targeted ESLint: PASS.
- Deno check of Meta verifier, readiness and operational policy modules: PASS.
- Control Center build: PASS; existing warning about chunks larger than 500 kB remains.
- No full Quality Gate, migration or deployment was repeated.

## Exact independent deployment scope (requires new explicit approval)

1. Preserve a recoverable backup of marketing-social-runtime v49 and confirm approved tree contents.
2. Deploy only marketing-social-runtime with verify_jwt=true:
   `npx.cmd --offline --yes supabase@2.121.0 functions deploy marketing-social-runtime --project-ref vnmkupzptujtywnnabkp --import-map supabase/functions/marketing-social-runtime/deno.json`
3. Keep META_PUBLICATION_ENABLED=false, both image flags absent, TikTok and WhatsApp HOLD. No new
   migration or configuration change is required for this increment.
4. With separate commit/push authorization, publish the reviewed Control Center tree only to the
   existing github-pages-dev workflow, preserving all current flags and Supabase DEV target.
5. In an OWNER/ADMIN session verify editorial readback, explicit Meta account verification and
   gallery navigation. No real publication, scheduling automation, message or commercial mutation
   is included in this deployment approval.

External-image activation is excluded until SYNTHETIC_TEST_INVALID is explained and corrected with
focused evidence, followed by separately approved acceptance. No speculative SQL relaxation,
blind redeployment or automatic retry is proposed.
