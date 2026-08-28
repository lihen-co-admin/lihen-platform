# TANDA 13 — Operational Activation & DEV Readiness
## CUT 2 — Intelligence & Dashboard Semantic Hardening
Fecha: 2026-08-28

## Objetivo
Eliminar heurísticas numéricas no canónicas de LIHEN Intelligence y evitar que el dashboard mezcle unidades físicas con colas de trabajo discretas.

## Cambios
1. `dashboard-intelligence.ts`
   - elimina `score`;
   - elimina cálculos y thresholds numéricos de prioridad;
   - clasifica señales por prioridad semántica P1–P4;
   - ordena por prioridad categórica + id determinista.

2. `intelligence-assurance.ts`
   - elimina `PRIORITY_SCORE_MISMATCH`;
   - assurance ya no replica una segunda política score→priority;
   - conserva validación de IDs, procedencia, rationale, acción/ruta y guard READ ONLY.

3. `dashboard-operational-health.ts`
   - añade `queues` con dimensiones separadas:
     - `humanDecisions`;
     - `orders`;
     - `purchases`;
     - `pendingUnits`.
   - `pendingUnits` no se suma con pedidos/compras/decisiones.
   - `workQueueTotal` queda solo como compatibilidad y excluye unidades físicas.

4. `DashboardPage.tsx`
   - deja de presentar un total heterogéneo;
   - muestra el desglose descriptivo por dimensión.

5. Tests
   - verifican ausencia de score;
   - prioridad categórica determinista;
   - assurance sin thresholds duplicados;
   - separación explícita de unidades físicas.

## Seguridad / invariantes
- DEV only.
- No PROD.
- No migraciones.
- No EXECUTE.
- No canary.
- No auto-release.
- No AI -> Database.
- Human Decision -> controlled command/gate sigue separado.
