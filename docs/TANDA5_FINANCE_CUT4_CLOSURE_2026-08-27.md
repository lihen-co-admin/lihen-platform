# TANDA 5 · Finance · CUT 4 / CLOSURE

## Estado
**CLOSED / PASS**, sujeto a la evidencia local del último checkpoint validado para CUT 3 Recovery FIX 1.

## Alcance consolidado
TANDA 5 deja formalizados y visibles los siguientes controles financieros:

1. **Finance Readiness**
   - Estado `READY | REVIEW | BLOCKED`.
   - Valida cuentas activas, transferencias, reversos y cierres.
   - Es determinista y read-only.

2. **Ledger Integrity**
   - Contrasta saldo de cuenta contra la suma completa del ledger.
   - Valida cuenta y saldo esperado de cierres de caja.
   - No usa solo una ventana parcial de movimientos para decidir integridad.
   - Estado `PASS | REVIEW | BLOCKED`.

3. **Finance Operation Policy**
   - Protege nuevas operaciones ordinarias cuando readiness o integridad están bloqueados.
   - `EXPENSE`: cuenta activa, monto positivo y fondos suficientes.
   - `TRANSFER`: cuentas activas distintas, monto positivo y fondos suficientes.
   - `CASH_CLOSURE`: exige cuenta activa; toda diferencia requiere nota operativa.
   - `REVERSAL`: solo para `EXPENSE` y `ADJUSTMENT`, y nunca dos veces sobre el mismo movimiento.
   - `CREATE_ACCOUNT`: puede permanecer habilitado como acción de recuperación.

## Invariantes de cierre
- El ledger financiero es **append-only**.
- Los saldos se derivan del ledger; una diferencia se investiga, no se sobrescribe.
- Un cierre de caja con diferencia se documenta; no se corrige automáticamente.
- `SALE_INCOME` no se revierte desde Finanzas para simular la reversión de una venta.
- Pedido confirmado, venta completada y movimiento financiero permanecen conceptos separados.
- Finanzas no repara inconsistencias de Commerce o Inventory.
- No hay escrituras directas desde la UI a tablas de negocio; se conservan los repositorios/RPC controlados.
- No se introdujeron migraciones nuevas en TANDA 5.
- No PROD.
- No ejecución/canary/dispatch habilitados por esta tanda.
- LIHEN Intelligence permanece read-only: observa, explica y recomienda; no muta datos.

## Definition of Done — TANDA 5
- **Functional:** cuentas, egresos, transferencias, cierres, reversos y ledger quedan diferenciados y protegidos.
- **Architecture:** reglas deterministas en dominio; UI consume políticas, no las duplica como lógica ad hoc.
- **Security:** no se amplían permisos ni rutas de escritura directa.
- **Integrity:** readiness + ledger integrity bloquean operaciones ordinarias cuando existe evidencia crítica.
- **Auditability:** reversos son contramovimientos y las diferencias de cierre requieren evidencia textual.
- **UX:** FinancePage hace visibles readiness, integridad y motivos de bloqueo.
- **Regression:** el último checkpoint local reportó `pnpm check` completo en PASS.

## Resultado
**TANDA 5 — Finance queda cerrada.**

Siguiente bloque de roadmap: **TANDA 6 — Governance & Readiness**, reutilizando los gates ya existentes y evitando crear una segunda capa paralela de autorización o release governance.
