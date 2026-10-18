# Isolated synthetic image acceptance (prepared, not activated)

Base candidate: `accf99791733927db1a45350159481147cc444aa`.
The already applied `20261017_verified_external_product_images_dev.sql` is unchanged.
Pending incremental migration: `20261018_synthetic_image_test_dev.sql`.

## Boundary

- Project URL: `https://vnmkupzptujtywnnabkp.supabase.co`.
- Product: `8ebc8ca4-7c42-4e85-b42c-fbb218327101`.
- SKU: `SYNTHETIC-WEBP-DEV-20261017-01`.
- PNG fixture: `tests/fixtures/synthetic-dev.png` (600x600, 5,879 bytes).
- Source SHA-256: `8a2364c06d4a91acf5a65329a5f4a4701cbf911fab22c24d55202f69f1c294a6`.
- New action: `INGEST_SYNTHETIC_TEST_IMAGE`; separate server flag
  `LIHEN_SYNTHETIC_IMAGES_ENABLED` must equal `true`. Missing means disabled.
  The commercial flag and action retain their own activation check.
- The request still accepts only action, candidateId and operationKey. Actor comes from
  authenticated getUser and an ACTIVE OWNER/ADMIN profile, never from request evidence.

Synthetic evidence has explicit mode `SYNTHETIC_TEST`, documented provenance ID and document
hash, approvedAt and humanTestApproval. Commercial permission is explicitly false; authentic
photograph and exact commercial identity claims must be empty. Approval is bound to the same
resource/operation and expires within 30 minutes of approval and authorization creation.
No automated code supplies a human approval or fabricates source ownership.

The server reuses the existing download, PNG/WASM conversion, immutable upload, hash readback
and finalization chain. Synthetic mode uses the existing **private** `lihen-product-originals`
bucket, and `_synthetic_tests/{productId}/{imageId}/web/{webpSha256}.webp`.
Neither buckets nor Storage policies are changed. Finalization refuses a public bucket.

SQL checks the project ref from PostgREST's verified service JWT claims; it fails closed if
the ref is absent or different. A service credential without the project ref cannot run this
trial until its supported claims contract is confirmed. No project ID supplied by a browser
is accepted as a substitute. Local SQL tests set claims only on their isolated local database.

## Private registration, never commercial publication

Three service-only RPCs reuse the existing authority, rights and immutable authorization
records: read_synthetic_image_authorization, approve_synthetic_image_authorization and
finalize_synthetic_product_webp. The private synthetic_image_test_results table records one
transactional receipt for the fixed fixture, including source_type SYNTHETIC_TEST and the
verified derivative fingerprint. It has no public URL, no commercial eligibility and no
gallery, product_image_sources or product_image_storage_assets insertions.

The reserved product must remain INACTIVE, invisible, without a main image and with its fixed
SKU/UUID. SQL triggers reject its insertion into public.product_images, public.catalog_entries
or commercial product_image_sources. The commercial verifier rejects the reserved UUID.
There is no automatic promotion or conversion to VERIFIED_EXTERNAL. Receipt replay revalidates
authorization, expiry, revocation, project, binding and private Storage; concurrent requests
serialize through the existing authorization and product row locks.

## Acceptance and cleanup still require independent authorization

No remote migration, deployment, secret change, product creation, authorization provisioning,
Storage upload or deletion was performed for this change. Hosted acceptance is NOT completed.
It requires the incremental migration, a separately approved runtime deployment, an owned
HTTPS fixture source and provenance document, genuine human test approval, and an authorized
OWNER/ADMIN invocation without extracting browser credentials or publishing UI instrumentation.

Before activation confirm no other usable synthetic authorizations. Enable only the synthetic
flag, record a single operation, read the private object back and compare the derivative hash,
then remove the flag immediately even if invocation fails. Uncertain results must retain the
same candidateId, operationKey and imageId; reconcile, never create a replacement operation.

Cleanup: revoke the exact authorization, remove the exact private object via Storage API
(never direct storage.objects SQL), then in a database transaction delete the exact receipt,
authorization, rights row and reserved product, in that order. Delete the authority only if
dedicated and unreferenced; remove the hosted source/doc only if exclusively created for this
trial. Check all referencing rows before deletion; stop if any unexpected reference exists.
No CASCADE or broad prefix deletes. Keep a local audit report and compare original commercial
row/policy fingerprints before and after. The SQL cleanup order is rehearsed locally inside a
rolled-back transaction; hosted cleanup has not been attempted.
