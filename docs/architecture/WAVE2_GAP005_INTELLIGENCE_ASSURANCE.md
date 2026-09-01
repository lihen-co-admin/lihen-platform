# LIHEN WAVE 2 — GAP-005
## Intelligence Assurance V1

**Base requerida:** `32c2d868bf9a2c4f2fd6b1912313d2ef946c8e9e`  
**GAP:** GAP-005 — Intelligence Assurance  
**Acción:** EXTEND + REFACTOR / GENERALIZE  
**Cambio funcional visible:** 0  
**Migraciones Supabase:** 0  
**Cambios RLS:** 0  
**Cambios PROD:** 0  

## Evidencia real reutilizada

La plataforma ya contenía `apps/control-center/src/domain/intelligence-assurance.ts`.
Ese assurance verificaba:

- recommendation set vacío;
- IDs duplicados;
- source ausente;
- rationale ausente/incompleto;
- actionLabel / targetRoute inconsistentes;
- presencia del guard legacy `execution-held`.

También declaraba expresamente que Assurance no debe recalcular una segunda política de
prioridad.

GAP-005 no crea otro motor paralelo. Extrae/generaliza esa responsabilidad hacia
`@lihen/intelligence-core` y conserva el archivo actual como compatibility adapter.

## Target

Nuevo engine puro:

`evaluateRecommendationAssurance()`

El engine consume una proyección mínima:

- id
- source
- rationale
- actionLabel
- targetRoute
- executionGuard

El Core ya no conoce el identificador histórico `execution-held`.
El adapter actual traduce `recommendation.id === 'execution-held'` a
`executionGuard: true`, preservando el comportamiento existente.

Así, futuros productores (Product, Brand, Catalog, Document, Analytics, Marketing/Social,
etc.) pueden usar Assurance sin adoptar un ID especial del Dashboard.

## Separaciones congeladas

Assurance:
- valida calidad/trazabilidad/guardas;
- NO recalcula priority;
- NO clasifica risk;
- NO resuelve Permission;
- NO aprueba;
- NO ejecuta Controlled Commands;
- NO persiste;
- NO llama Supabase.

Permission Model (GAP-004), Risk, Human Decision y Controlled Command siguen siendo gates
distintos.

## Marketing / Social readiness

No se implementa Marketing/Social.

El cambio evita acoplar assurance futuro a `execution-held`, permitiendo que una futura
recomendación Social declare una guardia de ejecución sin heredar semántica del Dashboard.

## Archivos previstos

- `packages/intelligence-core/src/assurance.ts`
- `packages/intelligence-core/src/index.ts`
- `packages/intelligence-core/tests/assurance.test.ts`
- `apps/control-center/src/domain/intelligence-assurance.ts`
- `tests/architecture/intelligence-assurance-generalization.test.ts`
- `docs/architecture/WAVE2_GAP005_INTELLIGENCE_ASSURANCE.md`

## Alcance negativo

No tablas, migraciones, RLS, providers, Orchestrator, Operations/RPC, UI, publishing,
Social APIs ni PROD.

Para DONE se exige `pnpm test:architecture` y `pnpm check` PASS.
