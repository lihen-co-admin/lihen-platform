# FASE 1.27 — Full test contract reconciliation

Date: 2026-08-21

## Context

The authoritative Windows Node 24 / pnpm 10.15 validation passed the complete TypeScript gate and lint reached the test gate. Vitest then reported 12 failures concentrated in `packages/products`.

## Root causes reconciled

1. DTO tests were still expecting the pre-slug/pre-business-line response shape.
2. Legacy mapper fixtures did not include canonical `slug` and `business_line` fields now required by the active read contract.
3. Controlled Supabase RPC mocks did not include `slug` / `business_line` fields returned by the current controlled write contract.
4. The controlled price-change test used a non-UUID product id even though the persisted row contract requires UUID identity.
5. The legacy taxonomy test imported the generic reconciliation normalizer instead of the intentionally aliased legacy normalizer.
6. Root JS/TS config files use ESM syntax, so the root package is explicitly marked `type: module` to remove Node/Vite module-type warnings.

## Safety

No production commercial rule was weakened to make tests pass. No price, visibility, identity, taxonomy match, RLS, storage, or write-gate behavior was bypassed. The stale tests/mocks were aligned to the active canonical contracts instead of making production schemas optional.

## Expected authoritative validation

On Node 24.x and pnpm 10.15.0:

```powershell
pnpm install --frozen-lockfile
pnpm check
```

The Windows run remains authoritative because this preparation environment is Node 22/Linux and cannot reproduce the Windows-native Vite/Rolldown dependency set from the lockfile without registry access.
