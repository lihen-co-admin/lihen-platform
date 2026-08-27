# QA-E — Delivery / Slots / Saturday-free Safety Closure

DEV gate: PASS (`QA_E_DELIVERY_SATURDAY_FREE_SAFETY_CLOSURE_V2`).

La política estándar nacional queda activa y source-backed con envío gratis desde $100.000 COP.

Se añadieron:

- políticas de servicio de entrega privadas;
- slots con capacidad y control de sobrecupo;
- una sola reserva activa por pedido;
- idempotencia por `operation_key`;
- reserva y liberación controladas de slots;
- activación de políticas solo por OWNER;
- lectura pública únicamente de políticas `ACTIVE`.

`SATURDAY_FREE_CALI` queda `DISABLED_PENDING_APPROVAL`. No existe una fuente pública aprobada que defina todavía cobertura, fechas y cupos de sábado gratis. Para activarlo en el futuro se exige una fuente aprobada y al menos un slot futuro de sábado con capacidad disponible.

Esto cierra QA-E a nivel de capacidad y seguridad sin publicar un beneficio comercial no verificado.
