# TANDA 13 — Recovery Manifest
Fecha: 2026-08-28

Baseline de recuperación previo a TANDA 13:
`5ef8f68` — `feat: consolidate admin commerce intelligence and public experience`

## CUT 1 — Publishing + Governance semantic hardening
- governance evidence sin ventana de 72h inventada;
- tolerancia futura sin +5 min implícitos;
- artifact integrity REVIEW/no blockers antes de PUBLISHED;
- activación de versión desligada de selección efímera.

## CUT 2 — Intelligence + Dashboard semantic hardening
- se elimina score numérico y thresholds 90/60/30;
- assurance deja de duplicar score→priority;
- prioridad categórica P1–P4;
- colas operativas separan decisiones/pedidos/compras/unidades pendientes.

## CUT 3 — Operational readiness consolidation
- clasificación explícita de capacidades DEV;
- write modes siguen bloqueados por defecto;
- dispatch/canary/final execution/PROD permanecen retenidos.

## QA confirmado antes de CUT 3
- Typecheck PASS.
- Lint PASS.
- Tests: 93 archivos / 370 tests PASS.
- Architecture: 16/16 PASS.
- Build: PASS.
- Warning >500k chunk: deuda de performance, no bloqueante.

## Regla de recuperación
Si se necesita volver al estado previo a TANDA 13, el baseline remoto/canónico sigue siendo `5ef8f68` hasta que la tanda se cierre y se cree un nuevo commit explícito.
