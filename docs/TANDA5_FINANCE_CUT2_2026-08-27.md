# TANDA 5 — Finance · CUT 2

## Objetivo
Cerrar la brecha entre la vista resumida de movimientos y la verdad completa del ledger financiero, sin introducir escrituras nuevas ni mecanismos de autocorrección.

## Implementación

### 1. Ledger completo para integridad
Se añadió `FinanceRepository.listLedgerMovements()` como lectura separada de `listMovements()`.

- `listMovements()` conserva el límite operativo de los últimos 100 movimientos para la tabla de UI.
- `listLedgerMovements()` recupera la secuencia completa ordenada por `occurred_at` para readiness e integridad.
- No se agregó escritura directa ni acceso a tablas desde la UI.

### 2. Política `evaluateFinanceLedgerIntegrity()`
Nueva política determinística y read-only que valida:

- saldo reportado por cuenta vs suma completa del ledger;
- existencia de la cuenta usada por cada cierre;
- saldo esperado del cierre vs movimientos acumulados hasta su fecha de corte;
- diferencias entre saldo contado y esperado.

Estados:

- `PASS`
- `REVIEW`
- `BLOCKED`

Señales:

- `ACCOUNT_BALANCE_MISMATCH`
- `CLOSURE_ACCOUNT_MISSING`
- `CLOSURE_EXPECTED_BALANCE_MISMATCH`
- `CLOSURE_VARIANCE`

### 3. Control Center
`FinancePage` ahora:

- usa el ledger completo para readiness y métricas financieras;
- mantiene los últimos movimientos para presentación operativa;
- muestra estado de integridad del ledger;
- muestra conciliación de saldos y cierres;
- genera señales LIHEN Intelligence sin corregir datos;
- mantiene la selección de formularios restringida a cuentas activas, incluso después de refrescar datos.

## Invariantes preservados

- saldo financiero = derivación del ledger, no valor editable;
- reversión = contramovimiento, no UPDATE/DELETE del original;
- cierre con diferencia = señal a investigar, no autorización para reescribir saldo;
- Finance no corrige Commerce ni Inventory;
- Intelligence es read-only;
- sin PROD;
- sin migraciones nuevas;
- sin habilitar ejecución adicional.

## QA esperado

Ejecutar localmente:

```bash
git diff --check
pnpm check
git status
```

El CUT queda **IMPLEMENTATION COMPLETE — PENDING LOCAL CHECKPOINT** hasta recibir el resultado completo.
