# TANDA 6 — Governance & Readiness · CUT 2

## Objetivo
Consolidar evidencia de governance y frescura de auditoría sin crear nuevos gates ni abrir ejecución.

## Cambios
- Se añade `evaluateGovernanceEvidence(...)` como política determinística y read-only.
- Se valida que el timeline de governance y el timeline operacional tengan evidencia bien formada.
- Se detectan ventanas vacías, evidencia stale y eventos materialmente fechados en el futuro.
- La falta de actividad reciente genera `REVIEW`, no inventa actividad ni abre ejecución.
- Evidencia malformada o fechada materialmente en el futuro genera `BLOCKED`.
- Se añade `evaluateGovernanceAssurance(...)` para combinar de forma conservadora:
  - Governance readiness existente.
  - Evidencia y frescura.
- `OperationsPage` muestra `Governance assurance` como lectura consolidada, manteniendo `execution BLOCKED`.

## Invariantes preservados
- No se crea una segunda capa de gates.
- No se habilita ejecución.
- No se confirma, libera ni ejecuta ninguna operación desde Intelligence/readiness.
- No se escribe en PROD.
- No hay auto-fix ni mutaciones de negocio.

## Resultado esperado
`READY | REVIEW | BLOCKED` para evidencia y assurance, con trazabilidad explícita y sin convertir ausencia de actividad en un falso PASS.
