LIHEN PLATFORM — CORE CLOSURE WAVE 1
Baseline: 10e5098

This patch synchronizes the repository with schema changes already applied in Supabase DEV.

Includes:
- @lihen/suppliers
- @lihen/procurement
- @lihen/inventory
- @lihen/catalog
- CORE 03 / 05 / 07 migrations
- architecture-boundary tests
- closure documentation

Important:
- No legacy supplier/purchase/catalog rows are imported.
- Existing 952 Product Master rows are not modified.
- Browser writes remain closed for the new administrative tables.

Apply over the existing lihen-platform repository, preserving .git and local environment files.
Then run:
  pnpm install --frozen-lockfile
  pnpm check

Do not commit until pnpm check passes.
