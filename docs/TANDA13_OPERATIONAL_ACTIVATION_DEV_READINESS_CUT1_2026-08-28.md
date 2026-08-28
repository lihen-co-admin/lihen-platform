# TANDA 13 — Operational Activation & DEV Readiness
## CUT 1 — Pre-Activation Semantic Hardening
Fecha: 2026-08-28
Baseline: `5ef8f68`
Rama de trabajo esperada: `next-phase`

## Objetivo
Cerrar deudas semánticas previas a cualquier activación operativa en DEV sin habilitar ejecución final, canary real, release automático ni writes a PROD.

## Cambios
1. Governance evidence
   - elimina la ventana de frescura implícita de 72 horas;
   - la evaluación de stale queda opt-in mediante `freshnessWindowHours`;
   - elimina la tolerancia futura implícita de 5 minutos;
   - el desfase futuro queda en 0 por defecto y solo admite tolerancia si el consumidor la declara explícitamente;
   - `executionMustRemainBlocked` continúa en `true`.

2. Publishing artifact integrity
   - la política de integridad del artefacto se aplica como bloqueo únicamente cuando la versión está `PUBLISHED`;
   - estados DRAFT/READY_TO_RENDER quedan en `REVIEW` con `ARTIFACT_NOT_PUBLISHED_YET` y sin blockers de artefacto prematuros.

3. Catalog activation
   - la activación deja de depender de la selección efímera actual de checkboxes;
   - `selected.size === 0` permanece únicamente en Guardar snapshot;
   - Activar versión depende del estado DRAFT y del contrato/RPC canónico que valida el snapshot persistido.

## Seguridad
- No se añade ningún RPC.
- No se modifica ninguna migración.
- No se habilita `EXECUTE` de governance.
- No se habilita canary.
- No se toca PROD.
- No se introduce AI -> Database.

## QA esperado local
```bash
git diff --check
pnpm --filter @lihen/control-center test -- governance-evidence.test.ts publishing-artifact-integrity.test.ts
pnpm check
git status --short
```
