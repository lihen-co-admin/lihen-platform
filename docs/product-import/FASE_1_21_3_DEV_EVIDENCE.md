# FASE 1.21.3 — DEV Evidence

## Final gates

- Business line: `BEAUTY_CARE`.
- Evidence runs: 1.
- Identity evidence proposals: 37.
- Candidate evidence proposals: 187.
- Human candidate decisions: 0.
- Human identity resolutions: 0.
- `public.products`: 0.
- `product_images`: 0.
- Storage objects: 0.

## Identity proposals

- `VARIANT_SET`: 22.
- `DUPLICATE_REFERENCE`: 9.
- `DEFER`: 6.

Confidence distribution:
- Duplicate: 2×95, 3×90, 4×80.
- Variant: 4×80, 11×70, 7×65.
- Defer: 6×40.

## Candidate proposals

- `APPROVE_CREATE`: 104 at confidence 85.
- `WAIT_IDENTITY_RESOLUTION`: 79 at confidence 100 for queue dependency only.
- `DEFER`: 4 at confidence 40.

`WAIT_IDENTITY_RESOLUTION=100` means only that the candidate must wait for group identity resolution. It is not 100% product identity confidence.

## Business-line hardening

Migration `20260821181449_review_evidence_business_line_alignment` aligned the evidence run and both proposal tables to `business_line`. All existing 1.21.3 proposals are explicitly `BEAUTY_CARE`, and all 37 identity keys are scoped with the `BEAUTY_CARE|` prefix.

## Safety rule

`PROPOSAL != HUMAN DECISION != PRODUCT INSERT`

All proposals retain `requires_human_approval=true`.
