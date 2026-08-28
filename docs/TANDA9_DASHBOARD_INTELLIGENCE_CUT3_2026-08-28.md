# TANDA 9 — Dashboard Intelligence · CUT 3
Fecha: 2026-08-28

## Objetivo
Convertir el `nextFocus` determinístico del Dashboard en una guía operativa navegable sin convertirla en un comando.

## Implementación
Se agrega `evaluateDashboardFocusGuidance(...)`.

La guía traduce el foco ya calculado a:
- tono;
- título;
- explicación;
- acción de navegación opcional;
- ruta existente opcional.

Mapeo:
- INTEGRITY → `/operations`
- HUMAN_DECISION → `/operations`
- ORDERS → `/orders`
- PURCHASES → `/purchases`
- INVENTORY → `/inventory`
- INTELLIGENCE_ASSURANCE → revisión en el propio Dashboard, sin inventar ruta
- MONITOR → sin acción sintética

## Invariantes
- `navigationOnly = true`
- `mayMutateDomain = false`
- no crea comandos;
- no ejecuta RPCs;
- no aprueba recomendaciones;
- no cambia gates;
- no toca PROD.

El Dashboard ahora puede orientar al operador hacia una superficie existente, pero el clic solo navega. Cualquier mutación posterior continúa bajo los contratos, comandos y gates de esa superficie.
