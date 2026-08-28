# TANDA 8 — LIHEN Intelligence Expansion · CUT 3
Fecha: 2026-08-27

## Objetivo
Formalizar el paso entre recomendación y decisión humana sin convertir Intelligence en una capa de ejecución.

## Implementación
Se agrega `evaluateIntelligenceDecisionPolicy(...)` con estados:
- OBSERVE
- REVIEW
- APPROVABLE
- BLOCKED

Reglas:
- Assurance BLOCKED impide el handoff.
- Assurance REVIEW permite inspección, pero no decisión.
- PASS + recomendación informativa => OBSERVE.
- PASS + acción y ruta sugeridas => APPROVABLE.
- `mayExecuteAutomatically` es siempre `false`.

También se agrega un resumen agregado de recomendaciones:
- approvableCount
- reviewCount
- blockedCount
- observeCount
- executionMustRemainManual = true

## Integración UI
Dashboard muestra cuántas recomendaciones pueden presentarse para decisión humana y recuerda que la ejecución sigue siendo manual/controlada.

## Seguridad
No se crean comandos.
No se llama a RPCs.
No se escribe en dominio.
No se modifica PROD.
No existe auto-approval ni auto-execution.
