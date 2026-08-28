# TANDA 14 — Controlled DEV Activation Pilot
## CUT 2 — Single-domain candidate selection
Fecha: 2026-08-28

## Resultado
El primer dominio candidato es **SUPPLIERS**.

Esto NO significa que el write mode quede habilitado. La selección únicamente
reduce el alcance del próximo preflight a un dominio de datos de referencia.

## Por qué SUPPLIERS primero
La composición del Control Center ya tiene un `VITE_SUPPLIER_WRITE_MODE`
independiente y un repositorio Supabase con `controlledWriteEnabled`.

A diferencia de inventario, compras, pedidos, ventas y finanzas, el mantenimiento
de proveedores no implica por sí mismo:
- movimiento de stock;
- reserva de inventario;
- venta;
- movimiento financiero;
- finalización de pedido.

Product Master tampoco se usa primero porque es dato canónico y puede afectar
eligibilidad/publicación aguas abajo.

## Estado real
`SUPPLIERS` sigue **EVIDENCE_INCOMPLETE** hasta confirmar en el código y en DEV:

1. RPC/command exacto usado para create/update.
2. Operation key/idempotencia actor-bound.
3. RLS/role OWNER/ADMIN.
4. Evidencia de audit trail.
5. Estrategia de compensación para el fixture.
6. Fixture DEV aislado e identificable.
7. Lectura post-write que demuestre exactamente el resultado.
8. Repetición con la misma operation key que demuestre idempotencia.
9. Confirmación de que PROD no participa.

## Regla para CUT 3
No editar `.env` todavía.
No habilitar `VITE_SUPPLIER_WRITE_MODE=controlled` hasta que los puntos anteriores
queden respaldados por evidencia concreta.

Dispatch, canary, final release y PROD siguen fuera del piloto.
