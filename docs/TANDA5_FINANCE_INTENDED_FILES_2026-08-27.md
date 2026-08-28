# TANDA 5 · Finance — Intended Files

## CUT 1
- `apps/control-center/src/pages/FinancePage.tsx`
- `packages/finance/src/index.ts`
- `packages/finance/src/domain/finance-readiness.ts`
- `packages/finance/tests/finance-readiness.test.ts`
- `docs/TANDA5_FINANCE_CUT1_2026-08-27.md`

## CUT 2
- `apps/control-center/src/pages/FinancePage.tsx`
- `packages/finance/src/index.ts`
- `packages/finance/src/ports/finance-repository.ts`
- `packages/finance/src/infrastructure/supabase-finance-repository.ts`
- `packages/finance/src/domain/finance-ledger-integrity.ts`
- `packages/finance/tests/finance-ledger-integrity.test.ts`
- `docs/TANDA5_FINANCE_CUT2_2026-08-27.md`

## CUT 3 / Recovery FIX 1
- `apps/control-center/src/pages/FinancePage.tsx`
- `packages/finance/src/index.ts`
- `packages/finance/src/domain/finance-operation-policy.ts`
- `packages/finance/tests/finance-operation-policy.test.ts`
- Recovery restauró el módulo `packages/finance` completo para evitar borrados accidentales al aplicar paquetes incrementales.
- `docs/TANDA5_FINANCE_CUT3_2026-08-27.md`

## CUT 4 / Closure
- `docs/TANDA5_FINANCE_CUT4_CLOSURE_2026-08-27.md`
- `docs/TANDA5_FINANCE_INTENDED_FILES_2026-08-27.md`

## Exclusiones intencionales
- `node_modules/`
- `dist/`
- `.git/`
- `*.tsbuildinfo`
- CSV históricos
- migraciones históricas no pertenecientes a TANDA 5
- artifacts/patches/ZIPs antiguos
- PROD
