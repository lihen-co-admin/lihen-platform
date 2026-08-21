# FASE 1.21.2 DEV Evidence

Validated against Supabase DEV on 2026-08-21.

- Review queue: 187 candidates.
- 74 CONFLICT.
- 113 REVIEW_REQUIRED.
- Current conflict topology: 31 multi-member identity groups containing 67 candidates, plus 7 residual singleton conflicts.
- Candidate decisions recorded: 0.
- Identity resolutions recorded: 0.
- public.products: 0.
- `record_product_candidate_decision_controlled`: SECURITY DEFINER; anon/authenticated EXECUTE revoked.
- `record_product_identity_resolution_controlled`: SECURITY DEFINER; anon/authenticated EXECUTE revoked.
- Direct authenticated SELECT on new private resolution/operation tables: false.
- Security Advisor: no new issue from this phase; existing Auth warning remains `Leaked Password Protection Disabled`.

Migrations applied in DEV:
- 20260821173232 product_candidate_review_resolution_foundation
- 20260821173318 harden_product_identity_resolution_multi_member_only
