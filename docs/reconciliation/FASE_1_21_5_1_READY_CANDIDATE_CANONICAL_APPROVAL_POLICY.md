# FASE 1.21.5.1 — READY CANDIDATE CANONICAL APPROVAL POLICY

## Decision

`READY_CANDIDATE` is canonically auto-approvable only when all policy gates pass:

- business line is canonical;
- no human decision exists;
- catalog audit did not flag review;
- image SHA-256 is valid;
- brand or category taxonomy anchor exists;
- category and business line agree;
- identity is unique across the entire candidate run, not merely within READY candidates.

Policy key: `READY_CANDIDATE_CANONICAL_APPROVAL_V1`.

## DEV result

The complete 816-row `BEAUTY_CARE` READY set passed all gates with zero exceptions.

- Policy approved: **816**
- Human approved from FASE 1.21.4: **136**
- Canonical approved projection: **952**
- Rejected: **6**
- Deferred: **45**
- `public.products`: **0**

The approval operation was executed once under an ACTIVE OWNER context, replayed with the same operation key to prove idempotency, and then re-locked.

## Authority boundary

`APPROVED_BY_POLICY != PRODUCT INSERT`.

This phase records canonical approval only. It does not allocate the final combined 952-row import run and does not write Product Master rows.
