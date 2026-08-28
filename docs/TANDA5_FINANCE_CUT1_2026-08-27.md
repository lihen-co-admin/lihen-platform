# TANDA 5 — Finance · CUT 1

## Objetivo
Consolidar una lectura determinística de readiness financiero sobre cuentas, transferencias, reversos y cierres de caja sin introducir auto-fixes ni escrituras adicionales.

## Implementación
- Nueva política `evaluateFinanceReadiness()` en `@lihen/finance`.
- Estados: `READY | REVIEW | BLOCKED`.
- Valida disponibilidad de cuentas activas.
- Valida que cada movimiento apunte a una cuenta conocida en la lectura.
- Valida transferencias `TRANSFER_OUT + TRANSFER_IN` como par único, balanceado y entre cuentas distintas.
- Valida reversos contra movimiento original, misma cuenta, monto exactamente compensatorio y unicidad.
- Diferencias de cierre generan `REVIEW`, no edición de saldo.
- `FinancePage` expone readiness e issues de forma read-only.
- Formularios operativos usan únicamente cuentas activas, alineados con los RPC controlados existentes.

## Invariantes preservados
- Ledger append-only.
- Reversión = contramovimiento; nunca overwrite.
- `SALE_INCOME` no se revierte desde Finanzas.
- Transferencias permanecen balanceadas.
- Cierre con diferencia no modifica saldo por sí mismo.
- Sin PROD, sin nuevas migraciones, sin ejecución automática.

## Checkpoint requerido
`git diff --check`
`pnpm check`
`git status`
