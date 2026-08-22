# FASE 2.8B — Operaciones financieras controladas

Implementa egresos, transferencias entre cuentas, reversión mediante contramovimiento y cierres/conteos de caja.

Reglas:
- El ledger es append-only; no se borra historia.
- Un egreso se registra con signo negativo.
- Una transferencia produce exactamente un `TRANSFER_OUT` y un `TRANSFER_IN` con el mismo `transfer_id` y suma cero.
- La reversión financiera directa solo admite `EXPENSE` y `ADJUSTMENT`. `SALE_INCOME` y transferencias requieren su flujo de dominio, evitando romper inventario o una pareja de transferencia.
- El cierre de caja es un snapshot del saldo esperado frente al contado; no corrige automáticamente la diferencia.
- Todas las escrituras requieren perfil ACTIVE con rol OWNER/ADMIN y operation keys idempotentes.
- Los saldos legacy continúan fuera de esta fase hasta la reconciliación/cutover.
