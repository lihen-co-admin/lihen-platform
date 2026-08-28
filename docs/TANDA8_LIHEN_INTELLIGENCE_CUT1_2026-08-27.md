# TANDA 8 — LIHEN Intelligence Expansion · CUT 1
Fecha: 2026-08-27

## Objetivo
Convertir el dashboard de una colección de avisos locales en una primera capa de recomendaciones determinísticas, priorizadas y explicables.

## Implementación
Se añade `evaluateDashboardIntelligence()` con:
- prioridad `P1 | P2 | P3 | P4`;
- score determinístico;
- severidad;
- explicación;
- fuente;
- rationale explícito;
- ruta sugerida.

## Reglas
- Integridad tiene precedencia sobre señales operativas.
- Stock pendiente y pedidos abiertos generan recomendaciones explicables.
- Ausencia de cuentas financieras activas genera advertencia, nunca un write.
- `execution-held` permanece siempre visible.
- No hay IA generativa en el camino crítico.
- No hay auto-corrección.
- No hay escritura a base de datos.
- No hay nueva migración ni RPC.

## Flujo preservado
Domain Data → Read Models → Rules/Signals → Insight Engine → Recommendations → Intelligence UI

Nunca:
AI → Database
