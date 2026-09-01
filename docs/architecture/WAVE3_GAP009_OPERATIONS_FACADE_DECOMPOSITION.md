# LIHEN WAVE 3 — GAP-009
## Operations Facade — Conservative Decomposition V1

**Base exacta:** `afe0230acf8dc67696d754d047d285e872573dc9`  
**GAP:** GAP-009 — Operations Facade  
**Acción:** REFACTOR / DECOMPOSE preservando comportamiento  
**Migraciones Supabase:** 0  
**RPC nuevos/modificados:** 0  
**Cambios RLS:** 0  
**Cambios DB:** 0  
**Cambios UI:** 0  
**Cambios PROD:** 0  
**Execution / Canary / Release gates liberados:** 0

## Objetivo

Reducir responsabilidades mezcladas dentro de `composition/operations.ts` sin reemplazar
la infraestructura operacional existente.

Este primer paso de descomposición extrae piezas puras y estables:

1. contratos de datos → `operations-contracts.ts`;
2. mappers primitivos de respuestas → `operations-mappers.ts`.

`operations.ts` continúa siendo la fachada de compatibilidad y sigue siendo dueño de:

- creación del cliente existente;
- llamadas actuales a vistas/RPC;
- ensamblaje de operaciones;
- `createOperationsComposition()`;
- `operationsComposition`.

## Compatibilidad

Los contratos históricamente exportados desde `operations.ts` se re-exportan desde la
misma ruta. Por lo tanto los consumidores existentes no necesitan cambiar imports.

GAP-008 continúa importando:

`createOperationsComposition` desde `./operations`.

No se cambia esa relación.

## Por qué el refactor es conservador

`operations.ts` contiene actualmente múltiples responsabilidades y una superficie amplia
de RPCs controlados. Extraer todos los subdominios en una sola intervención elevaría el
riesgo de regresión.

GAP-009 V1 aplica strangler/refactor incremental:

- primero contratos puros;
- luego helpers puros;
- fachada pública intacta;
- ejecución intacta.

No se mueve todavía el acceso Supabase a adapters separados porque eso implicaría una
reorganización mayor que debe hacerse en pasos verificables, sin cambiar comportamiento.

## Invariantes

- no segundo command engine;
- no nuevo RPC;
- no cambio de operation_code;
- no cambio de payload;
- no cambio de confirmation token;
- no cambio de operation intent;
- no cambio de execution readiness;
- no cambio de canary;
- no cambio de release authorization;
- no cambio de audit timeline;
- GAP-008 sigue compatible.

## Known debt después de V1

`operations.ts` seguirá siendo grande y contendrá acceso directo a Supabase. Esto queda
como deuda **clasificada**, no oculta.

La siguiente descomposición futura puede separar, detrás de la misma fachada:

- observability/dashboard;
- operation catalog/contracts;
- intent/preview/confirmation;
- readiness/dispatch;
- canary/release;
- audit/governance.

Cada extracción deberá conservar la fachada y pasar quality gate completo.

## Definition of Done

- contracts extraídos sin romper exports históricos;
- primitive mappers extraídos sin cambio semántico;
- `createOperationsComposition()` preservado;
- GAP-008 adapter preservado;
- cero RPC/SQL/migration/RLS nuevo;
- cero UI/PROD;
- cero gates liberados;
- unit tests PASS;
- architecture tests PASS;
- Typecheck PASS;
- Lint PASS;
- Build PASS;
- full `pnpm check` PASS.
