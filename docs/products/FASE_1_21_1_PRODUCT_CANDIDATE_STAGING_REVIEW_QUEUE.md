# FASE 1.21.1 — Product Candidate Staging & Review Queue

## Objective
Load the 1,003 canonical catalog product candidates into private DEV staging, build a deterministic private review queue, preserve all catalog image evidence hashes, and keep `public.products` untouched.

## Final DEV result

- Candidate run: `d4d17a39-008d-4bcc-88b2-384cc147e262`
- Run status: `COMPLETED`
- Total staged candidates: **1,003**
- `READY_CANDIDATE`: **816**
- `CONFLICT`: **74**
- `REVIEW_REQUIRED`: **113**
- Review queue: **187** = 74 priority-1 conflicts + 113 priority-2 review rows
- Human review decisions: **0**
- Canonical brand anchors: **877**
- Canonical category anchors: **126**
- Valid SHA-256 evidence hashes: **1,003 / 1,003**
- Missing SHA-256: **0**
- `auto_insert_allowed=true`: **0**
- `public.products`: **0**
- `public.product_images`: **0**
- Storage objects: **0**

## Safety model

A staged candidate is not a canonical Product. The staging tables and queue live in `lihen_private`, with no direct `anon` or `authenticated` access. No candidate can auto-insert because `auto_insert_allowed` is constrained to false.

The queue only surfaces `CONFLICT` and `REVIEW_REQUIRED`; the 816 ready candidates remain staged but still require a later controlled approval/import phase.

## SHA-256 completion

During bulk staging, 553 rows initially lacked `image_sha256` because a compact staging format omitted the hash. The defect was detected before phase close. 200 hashes were restored first, then the remaining 353 were restored from the canonical local manifest. Final gate: `missing_image_sha256 = 0` and `valid_image_sha256 = 1003`.

The temporary hash backfill function was removed immediately after verification.

## Transient DEV migrations

The remote DEV history records temporary staging bridges used only during controlled loading:

- `20260821165607 temporary_product_candidate_staging_ingest_bridge`
- `20260821170959 private_product_candidate_staging_batch_helper`
- `20260821171555 remove_temporary_product_candidate_staging_bridges`
- `20260821171620 private_candidate_hash_backfill_helper`
- `20260821172649 remove_candidate_hash_backfill_helper_after_staging`

These helpers are not part of the intended steady-state application surface; the final state has them removed.

## Security

No new Security Advisor finding was introduced. The pre-existing Supabase Auth warning `Leaked Password Protection Disabled` remains unrelated to this phase.

## Gate to next phase

FASE 1.21.1 is PASS only because all of the following hold simultaneously:

`1003 total / 816 ready / 74 conflict / 113 review / 187 queue / 1003 hashes / 0 missing hashes / 0 decisions / 0 auto-insert / 0 products`.
