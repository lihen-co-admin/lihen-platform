# TANDA 9 — Dashboard Intelligence · Intended Files
Fecha: 2026-08-27

## CUT 1
- apps/control-center/src/domain/dashboard-operational-health.ts
- apps/control-center/src/pages/DashboardPage.tsx
- apps/control-center/tests/dashboard-operational-health.test.ts
- docs/TANDA9_DASHBOARD_INTELLIGENCE_CUT1_2026-08-27.md

## Invariantes
- Dashboard sintetiza; no muta.
- Intelligence recomienda; no ejecuta.
- Integridad conserva precedencia.
- No se inventan thresholds temporales o cuantitativos para marcar blockers.
- Human Decision sigue separado de Application Command.
