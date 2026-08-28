# TANDA 5 · Finance · CUT 3 — Operation guards + cash closure policy

## Objetivo
Proteger nuevas escrituras financieras ordinarias cuando el ledger o el readiness financiero presentan bloqueos críticos, sin convertir el guard de UI en una reparación automática ni sustituir los RPC controlados existentes.

## Implementado
- Nueva política pura `evaluateFinanceOperationPolicy()`.
- `CREATE_ACCOUNT` permanece permitido como acción de recuperación cuando no existe una cuenta activa.
- `REVERSAL` permanece separado del bloqueo ordinario porque puede ser una acción controlada de remediación, pero:
  - solo aplica a `EXPENSE` y `ADJUSTMENT`;
  - no permite una segunda reversión del mismo movimiento.
- `EXPENSE` exige cuenta activa, monto positivo y saldo derivado suficiente.
- `TRANSFER` exige cuentas activas distintas, monto positivo y saldo suficiente en origen.
- `CASH_CLOSURE` exige cuenta activa y, si el conteo difiere del saldo esperado, una nota operativa que documente la novedad.
- `FinancePage` ejecuta el preflight antes de llamar al repository y deshabilita egresos, transferencias y cierres cuando `Finance readiness` o `Ledger integrity` están `BLOCKED`.
- La UI deja de ofrecer "Revertir" cuando ya existe un contramovimiento para el movimiento original.

## Invariantes
- Ledger append-only; no se sobrescriben saldos.
- Una diferencia de cierre se documenta, no se corrige automáticamente.
- Finanzas no revierte ventas; `SALE_INCOME` requiere workflow de Commerce/Sales.
- No hay escrituras directas desde UI a tablas.
- No hay migraciones nuevas en este CUT.
- No PROD.

## QA esperado
Ejecutar en el equipo local:

```bash
git diff --check
pnpm check
git status
```

El sandbox de generación no sustituye este checkpoint local.
