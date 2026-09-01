# LIHEN WAVE 3 — GAP-008
## Intelligence ↔ Existing Control Plane V1

**Base exacta:** `6a8a7c4c32b7fdf0b9c895dcd181cef6c9329c17`  
**GAP:** GAP-008 — Intelligence ↔ Existing Control Plane  
**Acción:** EXTEND / REUSE Existing Control Plane  
**Migraciones Supabase:** 0  
**Cambios RLS:** 0  
**Cambios DB:** 0  
**Cambios UI:** 0  
**Cambios PROD:** 0  

## Objetivo

Conectar de forma explícita:

Recommendation → Human Decision → Existing Operation Intent → Payload Validation →
Preview → Explicit Confirmation → Existing Controlled Plane → Audit.

No se crea un segundo command engine.

## Diseño

`@lihen/intelligence-core` incorpora una frontera neutral `ExistingControlPlanePort`.

El Core valida únicamente condiciones de handoff:
- Human Decision = APPROVE;
- decision.recommendationId coincide;
- correlation_id coincide;
- recommendation sigue accionable;
- operationCode y operationKey existen.

El mapeo `Recommendation → operationCode + payload` es explícito mediante
`RecommendationOperationMapping`. No se inventa una tabla universal de actionType→RPC.

## Preparación

`prepareApprovedRecommendationForControlPlane()`:

1. valida Recommendation + Human Decision;
2. invoca `validateOperationPayload()` del Existing Control Plane;
3. si el payload es inválido, BLOCKED;
4. si es válido, invoca `prepareOperation()`;
5. devuelve `READY_FOR_CONFIRMATION`;
6. NO confirma;
7. NO ejecuta.

## Confirmación

`confirmPreparedControlPlaneIntent()` es un paso explícito separado.

Requiere:
- preparación confirmable;
- token no vacío;
- token exacto generado por Existing Control Plane.

El Orchestrator no lo llama automáticamente.

## Adapter real

`apps/control-center/src/composition/intelligence-control-plane.ts` actúa sólo como
composition adapter:

- `validateOperationPayload` → `operations.validateOperationPayload`;
- `prepareOperation` → `operations.prepareOperation`;
- `confirmOperation` → `operations.confirmOperation`;
- `getAuditTimeline` → `operations.getControlCenterAuditTimeline`.

El adapter no importa Supabase directamente y no ejecuta RPC por sí mismo.
La implementación RPC ya existente sigue encapsulada en `composition/operations.ts`.

## Existing Control Plane preservado

Se reutilizan las foundations reales existentes:
- operation catalog;
- operation intents;
- payload validation;
- preview;
- confirmation token;
- execution enabled/held;
- execution readiness;
- dispatch/canary/release guards;
- audit timeline;
- RPCs *_controlled.

GAP-008 no libera execution gates ni cambia release/canary.

## Relación con otros GAPs

GAP-009 podrá descomponer `operations.ts` preservando behavior.
GAP-010 construirá Unified Human Review Queue sobre Human Decision.
GAP-040 validará role/grant/RLS matrix.
GAP-041/GAP-042 ampliarán idempotency/correlation/retry/observability.

## Future Marketing/Social

Futuros comandos externos también deberán terminar en Control Plane/Domain Adapter
autorizado. Intelligence no obtiene un camino alterno hacia APIs sociales.

## Definition of Done

- Recommendation no puede preparar operación sin Human APPROVE;
- correlation y recommendation linkage validados;
- payload pasa por Existing Control Plane validation;
- preview usa Existing Operation Intent;
- confirmación explícita y separada;
- audit disponible por Existing Control Plane;
- no segundo command engine;
- no SQL/RPC nuevo;
- no migraciones;
- no RLS;
- no PROD;
- architecture tests PASS;
- unit tests PASS;
- Typecheck/Lint/Build/Pnpm check PASS.
