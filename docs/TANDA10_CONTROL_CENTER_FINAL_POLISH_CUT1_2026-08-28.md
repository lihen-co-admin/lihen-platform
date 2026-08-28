# TANDA 10 — Control Center Final Polish · CUT 1
Fecha: 2026-08-28

## Objetivo
Iniciar el pulido final del Control Center con el Dashboard como superficie piloto, priorizando claridad administrativa, accesibilidad y reducción de ruido técnico sin tocar contratos funcionales.

## Cambios
Se agrega `admin-experience-state.ts` para resolver de forma determinística:
- LOADING
- ERROR
- EMPTY
- READY

La resolución define semántica accesible:
- error → `role="alert"` + `aria-live="assertive"`
- loading/empty → `role="status"` + `aria-live="polite"`
- loading → `aria-busy=true`

También se agrega `formatOperationalFocusLabel(...)` para evitar exponer enums técnicos como `HUMAN_DECISION` o `INTELLIGENCE_ASSURANCE` en la interfaz.

## Dashboard
- descripción del hero menos técnica;
- `Intelligence assurance` → `Integridad Intelligence`;
- `Dashboard integrity` → `Integridad Dashboard`;
- foco operativo mostrado con lenguaje administrativo;
- loading/error/empty con semántica accesible y microcopy consistente;
- spinner marcado como decorativo.

## Invariantes
- Sin cambios de dominio.
- Sin writes.
- Sin RPC nuevos.
- Sin migraciones.
- Sin cambios PROD.
- Sin alterar readiness, gates, recomendaciones o prioridades.
- Este CUT es exclusivamente UX/semántica/presentación.
