# Exact product image identity — DEV candidate

Base: `e0f4969dcf24a2105640b7b023dd70c7aae8a5f3`.

## Reused architecture

- `visual-intelligence.ts` remains the composition boundary. Existing Lens session RPCs are unchanged;
  evaluating/researching/reviewing photographs never invokes its mutating intake.
- `SearchPort`, `researchEditorialProduct`, `assessEditorialSearchResult` and the existing
  server-owned `EditorialAuthorityRecord` registry supply the governed research contract. No new
  search adapter, service, endpoint, key, storage implementation, flag or dependency is introduced.
- Existing media readiness and source selection evaluate quality and suggest a primary candidate
  separately from identity. Normalized catalog reconciliation is an internal crop association;
  its `MATCHED_EXACT`/confidence values are deliberately **not** external identity proof.
- There is no transfer callback from the panel to the manual URL-to-WebP conversion or queue.
  External preparation and save are disabled, even if a browser report claims exact identity,
  commercial rights and human approval. Manual uploads retain their existing conversion,
  authorization, SHA-256, operation identity and readback behavior.

## Identity and evidence contract

Research needs known manufacturer, official reference and all applicable variant dimensions:
tone, color, size, content, presentation and packaging. Non-applicable attributes must themselves
be evidenced rather than inferred. A known GTIN must match; otherwise the explicit, evidenced
`identifierStatus: NO_OFFICIAL_IDENTIFIER` is required. Internal SKU/catalog code never substitute
for these attributes. Human selection never overrides missing or contradictory evidence.

Each photograph must have a source extract binding its exact HTTPS URL to the exact product,
brand and attributes. Product-page evidence without a photograph binding is insufficient. Image
and source must currently share a hostname; third-party CDNs are conservatively rejected pending
an explicit authority/resource relationship contract. Generated or unknown provenance is rejected.

Source authority is independently checked using the existing registry, exact brand relationship,
role, validity dates and evidence reference. Official brands/product collections and authorized
suppliers are eligible; secondary sources, unknown resellers, Pinterest and stock sources are not.

Commercial rights are a separate permission extract scoped to the exact resource and LIHEN
catalog use with an expiry. Domain authority, AI confidence and human selection do not grant rights.
The contract expects structured extracts from a trusted governed server retrieval adapter, never
discovery snippets, model output or user-entered JSON. No such adapter is activated by this change.

Local stages: CANDIDATE → EXACT_IDENTITY_VERIFIED → RIGHTS_VERIFIED → HUMAN_APPROVED.
The local evaluator cannot issue READY_FOR_CONTROLLED_SAVE. A current browser report is never a
server write authorization. Expired authority or rights block progression. Search returns at most
five exact-identity candidates without padding; their
rights and rejection reasons remain visible. No external preview is downloaded automatically.

## Current operational limits — not a live image search activation

- Product Master's current DTO does not expose the required official reference, manufacturer or
  complete variant. The UI never guesses or provides an unrestricted "certify identity" input.
- The existing editorial provider does not deliver the photograph/rights evidence contract. The
  browser composition therefore has no configured image search dependency. A new service is not
  silently selected, and no browser credentials or paid searches are introduced.
- Current images are evaluated with dimensions from their existing gallery load, without another
  download. Identity remains INSUFFICIENT_EVIDENCE because the existing DTO carries no exact
  photograph-specific evidence. READY/FALLBACK quality does not authorize publication.
- BC-20869 (`27d3e080-4b71-0dc9-6fa8-19ade77a4ad2`, `BCV5-0870`, `´ MORADA (`) lacks sufficient
  identity. It gets zero external approved images and zero search calls. No product/taxonomy/media
  data is corrected or inferred.
- Completing live search requires a separately authorized extension of the **existing** governed
  server evidence contract and a trusted source for canonical reference/variant data. Backend,
  credentials, permissions, deployments and business writes remain outside this candidate.
- External save additionally needs the server component described below. The new typed selection
  envelope preserves requested identity, variant, content hashes, source/authority/rights evidence,
  operation and human approval bindings, but it grants **no** permission and is never downloaded,
  converted, or admitted into the manual queue by the panel.
- This candidate validates contracts, UI boundaries and regression behavior, not real-world image
  identity or commercial licensing for any real product. Existing manual uploads remain available
  under their existing user authorization controls.

## Blocking correction: missing server write-boundary verifier

The existing `registerProductWebp` sends product/image IDs, operation key, WebP SHA-256, alt text and
main-image choice to `add_product_webp_image_controlled`. It has no external provenance, license,
approval, revocation or source-to-derivative authorization contract. No change is made to it here.

A future server-owned ingestion/authorization component must fetch and hash the exact source
resource itself, control redirects/resource substitution and WebP transformation, and bind the
source and derivative hashes to product, canonical reference/variant, actor and stable operation.
Immediately before storage/registration and every retry it must revalidate independently trusted
identity evidence, current source authority, current commercial rights and a resource-specific human
approval. It needs durable replay/idempotency and revocation handling; browser objects, URL strings,
file names, local hashes and checkboxes are not proof. There is no accepted receipt/flag in this
candidate that can bypass this missing service. Implementing it requires separate authorization.

The manual queue rejects any known external-origin selection or retry record before the first side
effect, including mixed batches and records with missing evidence. This is compatibility defense,
**not server security**. If every provenance marker is maliciously removed, arbitrary browser bytes
cannot be distinguished from a manually supplied file on the client. We do not claim otherwise:
the panel has no external download/prepare/queue route at all, the external-save button is always
disabled and the local reviewer never emits save-ready permission. Existing manual URL/file uploads
remain under their existing manual user-attestation policy; they are not Intelligence-certified.

No external approval is stored in localStorage or reused after reload/product change. External
attempts are refused regardless of apparently valid, expired, conflicting or replayed metadata.

## Validation

Focused tests cover exact official identity, variant/reference contradictions, asset binding,
unregistered/expired authority, missing rights, generated assets, missing provider, free-only policy,
the five-image cap, BC-20869, independent quality evaluation and no writes/downloads during review.
Blocking-correction tests cover source/content/product/variant substitutions, unknown or expired
rights/authority/approval, replay after reload/operation change, queue/journal manipulation, whole-batch
refusal before writes, and preservation of ordinary manual retries. These prove refusal of external
ingestion, not that a server verification mechanism has been implemented.
Regression tests cover editorial research, media selection and WebP retries. Run the final Quality
Gate with pnpm 10.15.0; preserve generated build metadata outside the candidate index.
