# LIHEN WAVE 3 — GAP-010
## Unified Human Review Queue V1

**Base exacta:** `2b676faafc605602b226a74a143ea49177985d4b`  
**GAP:** GAP-010 — Unified Human Review Queue  
**Acción:** BUILD sobre decisions/reconciliation existentes  
**Migraciones Supabase:** 0  
**RPC nuevos/modificados:** 0  
**Cambios RLS:** 0  
**Cambios DB:** 0  
**Cambios UI:** 0  
**Cambios PROD:** 0  
**Ejecución automática:** 0

## Objetivo

Crear un único modelo de lectura/revisión para reunir trabajo humano pendiente sin
crear una segunda infraestructura de decisión.

La Queue unifica proyecciones provenientes de:

- Intelligence Recommendation;
- Product Reconciliation;
- Visual Intelligence;
- Supplier Candidate;
- Governance.

## Principio de autoridad

La Queue NO es source of truth de decisiones.

Cada item conserva:
- `sourceKind`;
- `sourceRecordId`;
- `correlationId`;
- evidence refs;
- existing decision ref;
- entity ref;
- metadata de origen.

Una decisión debe volver por el camino específico ya existente del source correspondiente.

## Intelligence Recommendation

La Queue reutiliza los contratos reales:

- `IntelligenceRecommendation`;
- `IntelligenceDecision`.

Valida:
- recommendationId;
- correlationId;
- decisión existente;
- status;
- priority/risk;
- evidence.

No genera una nueva Human Decision.

## Product Reconciliation

GAP-010 define una entrada neutral de reconciliación para proyectar resultados ya
existentes en el mismo read model.

Esto NO reemplaza:
- reconciliation runs/results;
- reconciliation decisions;
- visual intelligence decisions;
- supplier candidate decisions;
- RPCs `*_controlled`.

## Priorización

La Queue ordena por prioridad P0 → P3 y luego por fecha.

Para reconciliación:
- review requerido + confidence < 0.70 → P1;
- resto → P2.

Esta priorización es de presentación/review workload; NO equivale a autorización,
permiso o ejecución.

## Filtros

- sourceKinds;
- statuses;
- minimumPriority;
- requiresHumanDecisionOnly.

## Seguridad

La Queue:
- no escribe DB;
- no usa Supabase;
- no usa RPC;
- no ejecuta operations;
- no confirma intents;
- no publica;
- no altera Product Master;
- no altera Finance;
- no habilita PROD.

`assertReviewItemDoesNotAuthorizeExecution()` protege explícitamente contra metadata
que pretenda convertir un review item en autoridad de ejecución.

## Relación con GAP-008

GAP-008 permanece como único handoff gobernado desde Recommendation + Human Decision
hacia Existing Control Plane.

GAP-010 sólo facilita qué debe revisar una persona y muestra el estado ya decidido.

## Relación con siguientes Waves

GAP-011–014 podrán aportar nuevos review items de Product Variant / Assets /
Provenance / Channel Selection sin crear otra cola.

GAP-015–021 podrán integrar Brand/Supplier review sources bajo el mismo contrato.

## Definition of Done

- unified review read model;
- recommendation + existing decision projection;
- reconciliation projection;
- other controlled source projection;
- duplicate identity detection;
- source authority preserved;
- no decision persistence;
- no command engine;
- no SQL/RPC/RLS/migration;
- no UI/PROD;
- unit tests PASS;
- architecture tests PASS;
- Typecheck/Lint/Build/Pnpm check PASS.
