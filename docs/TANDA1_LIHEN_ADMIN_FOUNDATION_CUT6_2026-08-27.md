# TANDA 1 — LIHEN Admin Foundation · CUT 6

Fecha: 2026-08-27

## Objetivo
Cerrar la expansión transversal de la Admin Foundation con el Dashboard como vista ejecutiva consistente, DEV Auth Probe como herramienta técnica claramente segregada y un polish básico de accesibilidad/movimiento.

## Cambios
- Dashboard migrado a `AdminPageHero`, `SummaryStrip`, `OperationalNotice` e `IntelligencePanel`.
- Priorización read-only de integridad, stock pendiente, pedidos abiertos y governance.
- DEV Auth Probe migrado al mismo sistema visual y marcado como `DEV ONLY`.
- El histórico de cutover permanece visible como evidencia, pero ya no domina la experiencia ni expone ARM/RETRY/EXECUTE.
- Focus visible transversal para controles interactivos.
- Respeto de `prefers-reduced-motion`.
- Grid responsivo para diagnóstico técnico.

## Invariantes
- Intelligence permanece read-only.
- No hay writes directos a tablas de negocio.
- No se habilita execution, dispatch ni canary real.
- Producción permanece fuera de alcance.

## Definition of Done del corte
Debe pasar `git diff --check`, `pnpm check` y revisión de `git status` antes de cierre formal.
