# WAVE 9 / GAP-032 — LIHEN Cloud Workspace UI

## Classification

BUILD + REUSE / DELTA-FIRST.

## Recovery point

`3955e9c135bdf31be7ff9d9f3e873214f16d3f8b`

## Intent

Expose a read-only LIHEN Cloud workspace inside the existing Control Center so authorized operators can discover and audit assets/artifacts through the unified registry introduced by GAP-031.

## Authorities preserved

- Physical object authority: `storage.objects`.
- Unified read projection: `public.unified_asset_artifact_registry`.
- Product-image specialized registry: `lihen_private.product_image_storage_assets`.
- Catalog artifact metadata: existing `catalog_versions.artifact_*`.
- Existing `AppShell`, ProtectedRoute and browser Supabase client are reused.

## Delta

1. Add `/cloud` to the existing Control Center route tree.
2. Add a LIHEN Cloud / Workspace navigation entry.
3. Add `composition/cloud-workspace.ts` as a read-only registry adapter.
4. Add `CloudWorkspacePage.tsx` with summary, search, type/bucket filters and metadata table.
5. Add the minimum `storage.objects` SELECT policy required for the GAP-031 `security_invoker` view:
   - authenticated
   - profile `ACTIVE`
   - role `OWNER` or `ADMIN`
   - only four existing LIHEN Cloud buckets.
6. Add architecture tests for route, authority, read-only behavior, RLS scope and GAP boundary.

## Explicit non-goals

- No new bucket.
- No object move/copy.
- No upload.
- No delete.
- No metadata mutation.
- No canonical asset selection.
- No publication.
- No Product/Brand/Supplier master mutation.
- No Assistant, Context Resolver or Orchestrator UI.
- No PROD.

## DoD

- Control Center typecheck PASS.
- Architecture test for GAP-032 PASS.
- Root lint PASS.
- Control Center build PASS.
- Staging contains only GAP-032 authorized paths.
- Commit/push on `next-phase`.
- LOCAL HEAD = REMOTE HEAD.
- New recovery point registered.
- Master continuity updated with fresh revision + readback.
