# FASE 1.27 — Products strict TypeScript fix

Status: READY FOR AUTHORITATIVE WINDOWS VALIDATION.

Validated locally for `@lihen/products`:

- optional Zod fields are reconstructed without explicit `undefined`, preserving `exactOptionalPropertyTypes`;
- single-result reconciliation branches use non-null assertions only after `length === 1` checks;
- taxonomy import/reconciliation applies the same guarded-index contract;
- the package-root duplicate `normalizeTaxonomyText` export is resolved by exposing the legacy helper as `normalizeLegacyTaxonomyText`;
- no commercial matching, identity, pricing, visibility, or taxonomy decision rule was changed.

The authoritative Phase 1.27 gate remains the user's Node 24 / pnpm 10.15.0 Windows environment running:

```
pnpm install --frozen-lockfile
pnpm check
```
