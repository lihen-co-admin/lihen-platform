# FASE 2.8A — Cuentas financieras operativas

## Alcance
Se crean cuentas canónicas operativas (`CASH`, `DIGITAL_WALLET`, `BANK`, `OTHER`) y un ledger inmutable de movimientos.

Esta fase NO importa los saldos de efectivo/Nequi de LIHEN_ADMIN_PRO. Esos saldos siguen siendo evidencia legacy para Fase 3 y entrarán mediante reconciliación/cutover, no por números inventados.

`financial_account_balances` es una vista `security_invoker=true`, por lo que respeta RLS/permisos del usuario consultante.

## Pendiente posterior al gate visual
- egresos controlados;
- transferencias entre cuentas;
- reversión de venta;
- cierres/conciliación de caja;
- cutover de saldos legacy.
