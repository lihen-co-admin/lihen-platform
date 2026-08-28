# TANDA 6 — Governance & Readiness · CUT 1

## Objetivo
Consolidar en una política determinística y read-only la evidencia de governance ya existente, sin crear otra vía de ejecución ni duplicar los gates FASE 6–8.

## Implementación
- Nuevo `evaluateGovernanceReadiness(...)` en `apps/control-center/src/domain/governance-readiness.ts`.
- Estados: `READY | REVIEW | BLOCKED`.
- `BLOCKED` cuando una barrera material deja de proteger la ejecución: integridad con incidencias, operación habilitada, release no HELD, dispatch abierto, canary inseguro o guard final no bloqueante.
- `REVIEW` cuando las barreras siguen cerradas pero falta evidencia o un gate de governance no reporta `PASS`.
- `READY` únicamente cuando la evidencia está completa, los gates esperados están en `PASS` y **la ejecución continúa bloqueada**.
- `OperationsPage` consume esa política para el estado superior, summary, notice y métrica de governance.
- LIHEN Intelligence permanece read-only; no confirma, aprueba, libera ni ejecuta operaciones.

## Invariantes preservados
- No PROD.
- No auto-release.
- No auto-fix.
- No dispatch/canary real.
- Final execution sigue sin implementar.
- Los gates existentes siguen siendo la fuente de evidencia; este CUT solo los agrega e interpreta.

## QA esperada
```bash
git diff --check
pnpm check
git status
```
