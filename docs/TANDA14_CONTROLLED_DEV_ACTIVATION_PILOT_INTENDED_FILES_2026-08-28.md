# TANDA 14 — Intended files

## CUT 1
- `apps/control-center/src/domain/dev-activation-preflight.ts`
- `apps/control-center/tests/dev-activation-preflight.test.ts`
- `docs/TANDA14_CONTROLLED_DEV_ACTIVATION_PILOT_CUT1_2026-08-28.md`

## CUT 2
- `apps/control-center/src/domain/dev-pilot-candidate.ts`
- `apps/control-center/tests/dev-pilot-candidate.test.ts`
- `docs/TANDA14_CONTROLLED_DEV_ACTIVATION_PILOT_CUT2_2026-08-28.md`

## CUT 3
- `apps/control-center/src/domain/supplier-pilot-evidence.ts`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts`
- `docs/TANDA14_CONTROLLED_DEV_ACTIVATION_PILOT_CUT3_2026-08-28.md`
- `docs/TANDA14_SUPPLIER_PILOT_SOURCE_AUDIT_2026-08-28.json`
- `docs/TANDA14_SUPPLIER_PILOT_SOURCE_AUDIT_2026-08-28.md`

## QA Consolidation Reporter
- `tools/lihen-quality-gate.mjs`
- `docs/TANDA14_QA_CONSOLIDATION_REPORTER_2026-08-28.md`
- root `package.json` receives the quality-gate scripts through the safe installer.

## Transport only — never stage
- `APPLY_MANIFEST.txt`
- `tools/install-lihen-quality-gate.py`

No migrations.
No `.env`.
No Supabase write.
No PROD.
