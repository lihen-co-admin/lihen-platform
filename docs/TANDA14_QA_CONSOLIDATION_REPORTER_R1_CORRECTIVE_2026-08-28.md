# TANDA 14 — QA Consolidation Reporter R1 corrective
Date: 2026-08-28

The original classifier required path fragments with a leading slash, so repository-relative
paths such as `packages/products/tests/...` were misclassified as PLATFORM FOUNDATION.

R1 fixes classification by matching path segments safely in both:
- repository-relative paths;
- absolute Windows/POSIX paths.

No business logic, environment, database, migrations, Supabase, dispatch, canary,
final release, or PROD behavior is changed.
