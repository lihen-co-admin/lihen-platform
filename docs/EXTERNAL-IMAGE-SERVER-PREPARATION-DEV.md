# External photographs — server chain prepared for DEV, disabled by default

No migration, provider activation or deployment was performed on Supabase. No commercial
images or product rows were changed. Local PostgreSQL tests use synthetic fixtures only.
The HTTPS importer and Intelligence external-save UI remain blocked. Manual WebP is unchanged.

## Implemented chain

- `external-image-verification.ts` retains identity/reference/presentation/tone/variant/product
  version, actor, operation and candidate bindings; checks source hash, current authority,
  rights, approval, contradictions and post-conversion evidence. Its diagnostic is not a receipt.
- `external-image-download.ts` requires exact official HTTPS host, no credentials/fragments or
  nonstandard ports, validates public IPv4 DNS answers and pins the connection to the checked IP
  while preserving original-host TLS/SNI verification. IPv6 and all redirects are refused.
  Requests use no proxy/pool, identity encoding, 10-second deadline and 12 MiB streaming cap.
- Initial format support is **static PNG only**. Animation, malformed structure, dimensions below
  600 pixels or above 4096 pixels / 8 megapixels are refused before decoding. JPEG and external
  WebP inputs stay blocked until their parsers/decoder path have equivalent coverage.
- Direct conversion reuses the existing single-threaded catalog WASM converter in the Edge
  isolate. No Web Worker, native image library or subprocess is used. The pure PNG policy was
  extracted without changing the download rules, so conversion imports no Node networking.
  Conversion imposes tighter initial caps: 1,048,576 pixels and 3 MiB PNG input. WebP output is
  capped at 3 MiB and hashed by the server. Results exceeding 1,500 ms are refused before upload.
  A JavaScript timer cannot preempt synchronous WASM: the Edge supervisor owns hard CPU/memory
  enforcement; this code does not claim otherwise or silently raise platform limits.
- `external-image-ingestion.ts` reads only durable server authorizations, validates DEV URL and
  authenticated actor, uploads with an immutable image ID/path and `upsert:false`, reads stored
  bytes back to verify SHA-256, and calls the transactional finalizer. Uncertain operations reuse
  the same identity; committed results reconcile without another download/conversion/upload.
  It never removes an object after an uncertain response, and never uses the manual register RPC.
- `INGEST_VERIFIED_EXTERNAL_IMAGE` uses the runtime's existing getUser + ACTIVE OWNER/ADMIN gate.
  It accepts candidate ID and operation key only. The new server env gate
  `LIHEN_EXTERNAL_IMAGES_ENABLED` defaults OFF; no deployment configuration was changed.

## Pending migration (not applied)

`database/migrations/pending/20261017_verified_external_product_images_dev.sql` adds service-only
authority, resource-scoped commercial-rights documents (URI + document hash), and immutable
operation-bound authorizations. Creating an authorization requires a product-bound evidence
record and active human reviewer; the browser cannot provision it or invoke the finalizer.
The existing evidence, approval and rights claims must be reviewed facts, not AI assertions.
Unknown reference/presentation/variant/tone remains blocked. A non-applicable field requires a
reviewed explicit canonical value. These values are never inferred from a photograph.

The finalizer locks authorization, product, authority and license; rechecks product version/SKU,
revocation/expiry/approval, immutable operation, derivative fingerprint and storage metadata.
It inserts existing `product_image_sources` / `product_image_storage_assets` / `product_images`
with `VERIFIED_EXTERNAL` provenance, source URL/hash, derivative hash and requested view role.
Source byte size remains unknown in provenance rather than misreporting the derivative's size.
It deduplicates source and derivative hashes; allows five ACTIVE external images and ten total;
does not replace existing photos or main-image choices. Concurrent retries replay one result;
a competing fifth slot serializes on the product row. Authority/license revocation is serialized
with finalization. Revocation blocks future writes, not retroactive unpublication.

## Acceptance and operational limits

Unit tests cover synthetic transport/authorization/storage failures and manual/HTTPS regressions.
`tooling/test-external-images-postgres.mjs` runs actual SQL and concurrent transactions only on
127.0.0.1:56439 in a new synthetic database. It is not a Supabase migration runner.
`tooling/test-external-image-conversion.ts` runs the real direct decoder in Deno with a generated PNG.
`tooling/test-external-image-edge-runtime.mjs` builds ESZIP with the official installed Edge Runtime
v1.76.2 and invokes it through an actual user isolate (256 MiB, 2,000 ms hard CPU). It has no Supabase
credentials and uses only synthetic PNGs on localhost. A provisional package with redundant static
WASM inclusion was 33,087,368 bytes and one run reached the CPU limit; it was not accepted. The
minimal package relies on the npm assets already contained in ESZIP, is 17,014,724 bytes and passed
all five cases with unchanged limits, both with reused cache and with a new cache. The new-cache
run converted 600x600 and 1000x1000 static PNGs in 285-1,123 ms, rejected excessive/invalid inputs,
and confirmed `typeof Worker === 'undefined'`. The configured supervisor enforced the 256 MiB / 2 s
ceilings; reported JS heap/external memory is diagnostic, not a claim about total isolate memory.
This establishes local official Edge Runtime compatibility for the restricted initial budget;
hosted Storage/authorization acceptance and real deployment still require independent approval.
Results/runtime logs are generated under `.external-image-edge-proof/`, outside the Git candidate.
No alternative infrastructure was introduced. Deno-only success is not substituted for Edge proof.
Neither a mocked Storage adapter nor a PostgreSQL `storage.objects` fixture proves hosted Storage
policy compatibility or the hosted Edge runtime. Before activation, separately approve/apply the
DEV migration and deploy the disabled runtime, then perform authorized hosted acceptance. Until
that complete chain is proven, keep the env gate and browser importer OFF. No automatic search,
approval, publication, mass download or incorporation is enabled.

The new server modules pass their specific Deno typecheck. Strict checking of the complete existing
runtime entrypoint reports the same 22 diagnostics in the published base and this candidate
(extensionless imports and existing types outside this change). They were not suppressed or fixed
by altering unrelated modules. Full hosted runtime acceptance remains a required activation gate.

The existing 1,028-product inventory/manifests remain unchanged and are the only future batch
input. They supply neither exact identity certificates nor commercial licenses. Each resource
needs documented rights and human approval before its authorization can be provisioned.
