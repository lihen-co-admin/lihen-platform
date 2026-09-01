# LIHEN WAVE 2 — GAP-006
## Intelligence Orchestrator V1

**Base exacta:** `5fd74734055dec1ea49ef5fbacfefa0a2ddaa7ec`  
**GAP:** GAP-006 — Intelligence Orchestrator  
**Acción:** BUILD sobre Intelligence Core existente  
**Migraciones Supabase:** 0  
**Cambios RLS:** 0  
**Cambios UI:** 0  
**Cambios PROD:** 0  

## 1. Objetivo

Formalizar un Orchestrator puro y transversal que coordine:

REQUEST → INTENT → PERMISSION → CONTEXT → CAPABILITIES → EVIDENCE →
VERIFICATION → CANDIDATES/RECOMMENDATIONS → RESPONSE/HUMAN REVIEW.

No se implementa todavía Assistant UI, providers concretos, SQL, RPC ni Control Plane
execution.

## 2. Reutilización obligatoria

GAP-006 reutiliza:

- contratos de GAP-003;
- `evaluatePermission()` y permisos de GAP-004;
- la separación humana/ejecución ya congelada;
- Assurance de GAP-005 como gate separado de calidad de recomendaciones.

No crea un segundo Permission Engine ni un segundo Command Engine.

## 3. Contratos incorporados

- `IntelligenceIntent`
- `IntelligenceOrchestratorRequest`
- `IntelligenceCapabilityExecutionInput`
- `IntelligenceCapabilityExecutionOutput`
- `IntelligenceCapabilityHandler`
- `IntelligenceOrchestratorDependencies`
- `IntelligenceOrchestrationPlan`
- `IntelligenceOrchestratorExecution`

## 4. Planificación

`buildIntelligenceOrchestrationPlan()`:

1. conserva el orden declarado de capabilities;
2. elimina duplicados;
3. agrega `VERIFICATION` si el intent la requiere;
4. exige `intelligence.read_context`;
5. resuelve los permisos mínimos de Intelligence por capability;
6. produce un plan declarativo antes de ejecutar trabajo.

Permission != confidence != assurance != human approval.

## 5. Ejecución

`orchestrateIntelligenceRequest()`:

1. evalúa todos los permisos antes de ejecutar;
2. fail-closed si existe DENY/MISSING_GRANT;
3. preflight de handlers;
4. rechaza handlers duplicados;
5. ejecuta capabilities secuencialmente bajo un solo correlation id;
6. entrega evidencia acumulada a la siguiente capability;
7. agrega Evidence, Candidate y Recommendation;
8. devuelve `REQUIRES_REVIEW` cuando alguna Recommendation exige revisión humana;
9. devuelve `DEPENDENCY_FAILED` ante fallo real de una capability;
10. nunca ejecuta mutation/command/publish/finance.

La ejecución secuencial V1 evita ciclos capability↔capability. El Orchestrator es quien
coordina.

## 6. Límites frente a GAP-007 y GAP-008

GAP-007 sigue pendiente y será quien formalice Provider & Tool Abstraction:
SearchPort, VisionPort, DocumentExtractionPort, ImageGenerationPort, EmbeddingPort, etc.

Los `IntelligenceCapabilityHandler` de GAP-006 representan únicamente una frontera interna
de ejecución de capabilities. No son adapters de proveedor.

GAP-008 seguirá siendo responsable de:
Recommendation → Human Decision → Existing Operation Intent → Preview/Validation/
Confirmation → Controlled RPC → Audit.

## 7. Future Marketing / Social

No se implementa Marketing/Social.

El Orchestrator no conoce rutas UI, cuentas sociales ni APIs concretas. La composición se
basa en intent + context + capabilities y por ello puede ampliarse posteriormente sin
convertir Social en una excepción arquitectónica.

## 8. Alcance negativo

- NO SQL.
- NO Supabase.
- NO RLS changes.
- NO RPC.
- NO React.
- NO Assistant UI.
- NO providers concretos.
- NO OAuth.
- NO Social APIs.
- NO scheduler.
- NO publishing.
- NO Controlled Command execution.
- NO PROD.

## 9. Definition of Done

GAP-006 sólo puede cerrarse cuando:

- unit tests PASS;
- architecture tests PASS;
- permission fail-closed probado;
- verification orchestration probada;
- evidence chaining probado;
- human-review outcome probado;
- dependency failures probados;
- Typecheck PASS;
- Lint PASS;
- Build PASS;
- full `pnpm check` PASS.
