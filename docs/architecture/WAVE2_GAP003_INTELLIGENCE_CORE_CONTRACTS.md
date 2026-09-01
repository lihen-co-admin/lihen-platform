# LIHEN WAVE 2 — GAP-003
## Intelligence Core Contracts V1

**Base requerida:** `62da57a86efac43313a1962b28345cc803c90e41`  
**GAP:** GAP-003 — Intelligence Core Contracts  
**Cambio funcional visible:** 0  
**Migraciones Supabase:** 0  
**Cambios RLS:** 0  
**Cambios PROD:** 0  
**Provider específico:** ninguno  
**Orchestrator ejecutable:** todavía no  

## Objetivo

Formalizar el lenguaje transversal de LIHEN Intelligence como paquete independiente del
Control Center y de proveedores concretos. Esta intervención no implementa GAP-004,
GAP-005, GAP-006 ni GAP-007; únicamente crea los contratos que esos gaps consumirán.

## Nuevo paquete

`@lihen/intelligence-core`

Contratos incluidos:

- `IntelligenceContext`
- `IntelligenceCapability`
- `IntelligenceEvidence`
- `IntelligenceCandidate`
- `IntelligenceRecommendation`
- `IntelligenceDecision`
- `IntelligenceRisk`
- `IntelligenceRun`
- `IntelligenceResult`
- `ToolDescriptor`
- `SourceAuthority`
- `Confidence`
- `CorrelationId`

También se preservan los conceptos ya usados por Dashboard Intelligence:

- `IntelligencePriority`
- `IntelligenceSeverity`
- `source`
- `rationale`

Esto evita inventar un modelo incompatible con la foundation determinística existente.

## Fronteras

El Core:
- no importa React;
- no importa Supabase;
- no importa `@lihen/database`;
- no importa código de `apps/control-center`;
- no ejecuta SQL/RPC;
- no contiene permisos de mutación;
- no contiene provider implementations;
- no contiene Orchestrator ejecutable.

## Quality Gate

El classifier del quality gate se amplía únicamente para clasificar tests bajo
`packages/intelligence-core` como `INTELLIGENCE`.

## Estado esperado

Después de aplicar:
- GAP-003 = IMPLEMENTED, pendiente de quality gate;
- GAP-004..007 = no iniciados;
- cero cambio funcional;
- cero migración;
- cero RLS;
- cero PROD.

Para DONE se exige `pnpm check` PASS.
