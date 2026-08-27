# FASE 8.5 — Operation Intent Security Hardening

DEV: PASS.

Se corrigieron dos riesgos antes de acercarse a cualquier ejecución real:

- un `operation_key` existente queda ligado al actor que lo creó; otro actor no puede reutilizarlo ni obtener su token/intención;
- un intent PREVIEWED vencido pasa a `EXPIRED` de forma persistente y la confirmación devuelve `EXPIRED_NO_EXECUTION` sin lanzar una excepción que revierta el cambio.

Las 14 operaciones continúan con ejecución deshabilitada. Producción no fue tocada.
