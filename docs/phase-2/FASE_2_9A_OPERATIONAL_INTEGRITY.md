# FASE 2.9A — Integridad operacional

`public.operational_integrity_checks` es una vista `security_invoker` de solo lectura que detecta inconsistencias entre módulos.

Checks iniciales:
- stock ON_HAND/AVAILABLE/RESERVED/PENDING negativo;
- pedido COMPLETED sin venta;
- venta ligada a pedido cuyo pedido no quedó COMPLETED;
- total de venta diferente a sus items;
- venta sin ingreso financiero correspondiente;
- transferencia sin pareja balanceada;
- compra RECEIVED con cantidades incompletas;
- PENDING_IN de compra distinto a unidades pendientes de recibir.

No modifica datos y no sustituye los tests E2E. Sirve como observabilidad operativa y gate adicional antes del cutover.
