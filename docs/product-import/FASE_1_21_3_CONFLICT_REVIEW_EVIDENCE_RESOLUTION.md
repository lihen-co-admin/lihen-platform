# FASE 1.21.3 — Conflict & Review Evidence Resolution

## Scope

This phase studies the 187 unresolved `BEAUTY_CARE` candidates and persists evidence-based proposals only. It does not create products and does not register human approval on the user's behalf.

## Result

- 187 unresolved candidates studied.
- 37 current identity groups with 79 grouped candidates.
- 108 individual cases.
- Identity proposals: 22 `VARIANT_SET`, 9 `DUPLICATE_REFERENCE`, 6 `DEFER`.
- Candidate proposals: 104 `APPROVE_CREATE`, 79 `WAIT_IDENTITY_RESOLUTION`, 4 `DEFER`.
- 0 human candidate decisions.
- 0 human identity resolutions.
- 0 rows in `public.products`.
- 0 product images / Storage objects.

## Why 37 groups rather than the earlier 31 + 7 split

FASE 1.21.2 described the queue from `CONFLICT` status alone: 31 current multi-member conflict groups + 7 residual singleton conflicts + 113 review cases.

FASE 1.21.3 re-analyzes all 187 unresolved candidates together using current canonical identity context. That reveals groups crossing `CONFLICT + REVIEW_REQUIRED`, plus groups composed only of review-required candidates. Therefore, the evidence-analysis authority for this phase is 37 groups / 79 members + 108 individual cases.

## Evidence used

- catalog page and slot;
- normalized product name;
- canonical brand/category;
- `business_line`;
- visible final sale price;
- image SHA-256;
- perceptual comparison of catalog evidence crops;
- relative catalog placement;
- supplier evidence status;
- canonical audit reasons.

## Interpretation

- `DUPLICATE_REFERENCE`: evidence strongly suggests the same commercial reference appears more than once. Human approval is still required, especially if public prices conflict.
- `VARIANT_SET`: same identity context but visual/price differences are compatible with variants, presentations, shades, sizes, or related SKU-level distinctions. Do not merge automatically.
- `DEFER`: insufficient evidence for a safe identity conclusion.
- `APPROVE_CREATE`: individual candidate looks safe to create once a human approves the review decision.
- `WAIT_IDENTITY_RESOLUTION`: candidate belongs to an unresolved identity group; do not decide it independently first.

## Business-line safety

After dual-catalog hardening, the evidence run and proposal records are explicitly scoped to `BEAUTY_CARE`. Identity proposal keys now include the line prefix. Future STYLE evidence must run through its own STYLE-scoped candidate/evidence run.

## Invariant

`PROPOSAL != DECISION != PRODUCT INSERT`
