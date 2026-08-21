# FASE 1.21.2 — Product Candidate Review Resolution Foundation

## Purpose
Provide an auditable, idempotent review mechanism for the 187 staged candidates requiring intervention, without writing to `public.products`.

## Current DEV review topology
- 74 `CONFLICT` candidates.
- 113 `REVIEW_REQUIRED` candidates.
- After canonical taxonomy was applied, the 74 conflicts resolve into:
  - 31 actual multi-member identity groups containing 67 candidates.
  - 7 residual singleton conflicts that must be handled as individual candidate review, not group identity resolution.

## Candidate decisions
- `APPROVE_CREATE`
- `LINK_EXISTING_PRODUCT`
- `REJECT`
- `DEFER`

`LINK_EXISTING_PRODUCT` requires an existing `public.products.id`. Since DEV currently has zero products, it cannot currently be used.

## Identity-group resolutions
Only groups with more than one current canonical member may receive:
- `DISTINCT_PRODUCTS`
- `DUPLICATE_REFERENCE`
- `VARIANT_SET`
- `DEFER`

`DUPLICATE_REFERENCE` requires a canonical source reference from inside the same group.

## Safety
Both write RPCs are `SECURITY DEFINER`, require `auth.uid()`, `OWNER/ADMIN + ACTIVE`, use idempotent operation keys, and are installed with `EXECUTE` revoked from `anon` and `authenticated`.

No decisions or identity resolutions were recorded in this foundation phase. `public.products` remains empty.
