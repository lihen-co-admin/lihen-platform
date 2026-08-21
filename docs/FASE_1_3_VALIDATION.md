# FASE 1.2.1 + FASE 1.3 validation

## Static checks completed in this environment

- All `package.json` manifests parse successfully.
- Product domain contains no React or Supabase imports.
- Control Center pages contain no direct Supabase/database repository imports.
- `GetProductById` uses the existing `ProductRepository.findById` port.
- Supabase repository remains SELECT-only.
- Product precheck SQL contains SELECT/CTE introspection only and no DDL/DML mutations.
- FASE 1.2.1 SQL/RLS gate is present but **not executed against Supabase DEV** because DEV credentials/session are not available in this environment.

## Dependency limitation

The host has a global TypeScript compiler, but workspace dependencies are not installed. Therefore the full products/control-center typecheck cannot resolve workspace packages, `zod`, React or `@supabase/supabase-js`. This is an environment/dependency-installation limitation, not evidence that the slice passed compilation.

The authoritative validation on a machine with registry access remains:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
```

## DEV gate required before Supabase cutover

Run `database/validation/001_product_read_contract_precheck.sql` in Supabase DEV and complete `002_product_read_rls_authenticated_probe.md`. Do not mark FASE 1.2.1 PASS until evidence is saved.
