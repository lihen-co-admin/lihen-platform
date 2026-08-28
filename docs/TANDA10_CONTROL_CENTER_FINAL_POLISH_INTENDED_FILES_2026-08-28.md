# TANDA 10 — Control Center Final Polish · Intended Files
Fecha: 2026-08-28
Estado: CLOSED / PASS

## CUT 1
- apps/control-center/src/domain/admin-experience-state.ts
- apps/control-center/src/pages/DashboardPage.tsx
- apps/control-center/tests/admin-experience-state.test.ts
- docs/TANDA10_CONTROL_CENTER_FINAL_POLISH_CUT1_2026-08-28.md

## CUT 2
- apps/control-center/src/domain/admin-surface-semantics.ts
- apps/control-center/src/components/AdminPageHero.tsx
- apps/control-center/src/components/OperationalNotice.tsx
- apps/control-center/src/components/IntelligencePanel.tsx
- apps/control-center/src/components/SummaryStrip.tsx
- apps/control-center/tests/admin-surface-semantics.test.ts
- docs/TANDA10_CONTROL_CENTER_FINAL_POLISH_CUT2_2026-08-28.md

## CUT 3
- apps/control-center/src/styles/app.css
- apps/control-center/src/styles/tokens.css
- apps/control-center/tests/admin-responsive-polish.test.ts
- docs/TANDA10_CONTROL_CENTER_FINAL_POLISH_CUT3_2026-08-28.md

## CUT 4
- docs/TANDA10_CONTROL_CENTER_FINAL_POLISH_CUT4_CLOSURE_2026-08-28.md
- docs/TANDA10_CONTROL_CENTER_FINAL_POLISH_INTENDED_FILES_2026-08-28.md

## Invariantes
- El polish no cambia contratos de negocio.
- Menos ruido técnico en superficies administrativas.
- Estados y avisos accesibles.
- Responsive sin pérdida funcional.
- Foco visible y navegación por teclado.
- Touch targets mínimos.
- Reduced motion y forced colors.
- No overflow horizontal de la aplicación.
- Seguridad, readiness y gates preservados.
- No PROD.

## Packaging metadata
`APPLY_MANIFEST.txt` es metadata del paquete y no debe incluirse en staging salvo decisión explícita.
