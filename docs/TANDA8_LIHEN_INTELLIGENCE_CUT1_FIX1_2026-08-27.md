# TANDA 8 — LIHEN Intelligence · CUT 1 FIX 1
Fecha: 2026-08-27

## Motivo
El CUT 1 introdujo un error de TypeScript bajo `exactOptionalPropertyTypes` al mapear recomendaciones hacia `IntelligenceInsight`.

`actionLabel` y `targetRoute` son opcionales. El mapeo original los incluía siempre, pudiendo asignar explícitamente `undefined`. Con `exactOptionalPropertyTypes`, una propiedad opcional debe omitirse cuando no existe en lugar de escribirse como `undefined`.

## Corrección
`DashboardPage.tsx` ahora agrega `actionLabel` y `targetRoute` mediante spread condicional únicamente cuando contienen un valor.

## Alcance
- No cambia `evaluateDashboardIntelligence()`.
- No cambia prioridades, scores, severidades ni rationale.
- No agrega writes.
- No agrega RPCs.
- No agrega migraciones.
- No habilita ejecución.
- No toca PROD.
