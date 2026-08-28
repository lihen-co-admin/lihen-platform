# TANDA 14 — QA Consolidation Reporter R2 corrective
Date: 2026-08-28

## Why R2 exists
The first full consolidated run exposed two reporter-only defects:

1. ESLint treated `console` as undefined in the Node `.mjs` tool.
2. The reporter used Vitest suite counters for "Test Files", producing 198/198
   even though the actual executed file list is 97 files.

## Corrections
- Declares `console` as an allowed global for this Node CLI under the current ESLint config.
- Counts test files from `vitest.testResults.length`.
- Counts passed files only when that file has assertions and all assertions passed.
- Keeps individual tests and traceability sourced from the same Vitest JSON.

## Safety
No business logic is changed.
No `.env` is changed.
No Supabase call or write is made.
No migration is applied.
No dispatch, canary, final execution, or PROD behavior is changed.
