# TANDA 8 — LIHEN Intelligence Expansion · Intended Files
Fecha: 2026-08-27
Estado: CLOSED / PASS

## Archivos funcionales acumulados
- apps/control-center/src/domain/dashboard-intelligence.ts
- apps/control-center/src/domain/intelligence-assurance.ts
- apps/control-center/src/domain/intelligence-decision-policy.ts
- apps/control-center/src/pages/DashboardPage.tsx

## Tests
- apps/control-center/tests/dashboard-intelligence.test.ts
- apps/control-center/tests/intelligence-assurance.test.ts
- apps/control-center/tests/intelligence-decision-policy.test.ts

## Documentación
- docs/TANDA8_LIHEN_INTELLIGENCE_CUT1_2026-08-27.md
- docs/TANDA8_LIHEN_INTELLIGENCE_CUT1_FIX1_2026-08-27.md
- docs/TANDA8_LIHEN_INTELLIGENCE_CUT2_2026-08-27.md
- docs/TANDA8_LIHEN_INTELLIGENCE_CUT3_2026-08-27.md
- docs/TANDA8_LIHEN_INTELLIGENCE_CUT4_CLOSURE_2026-08-27.md
- docs/TANDA8_LIHEN_INTELLIGENCE_INTENDED_FILES_2026-08-27.md

## Invariantes
Domain Data → Read Models → Rules/Signals → Insight Engine → Recommendations → Intelligence Assurance → Human Decision Policy → Intelligence UI

LIHEN Intelligence → suggests → Human Decision → approves → Application Command → Policy/RLS/Gate → Domain

Nunca: AI → Database
Nunca: Intelligence → direct domain mutation

## Packaging metadata
`APPLY_MANIFEST.txt` es metadata del paquete y no debe incluirse en staging salvo decisión explícita.
