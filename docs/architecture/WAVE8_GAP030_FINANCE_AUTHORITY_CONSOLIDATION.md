# WAVE 8 — GAP-030 Finance Authority Consolidation

## Estado de diseño

**Clasificación: CONSOLIDATE + REUSE / DELTA-FIRST**

GAP-030 no crea un ledger, no migra datos y no agrega una tercera autoridad financiera. El cambio mínimo correcto es formalizar en `@lihen/finance` la autoridad que ya existe en DEV y protegerla mediante pruebas de dominio/arquitectura.

## Hallazgos de auditoría

La foundation de Finanzas ya contiene:
- `FinancialAccount`, `FinancialMovement` y `CashClosure`.
- `FinanceRepository` con lectura completa de movimientos (`listLedgerMovements`).
- `evaluateFinanceReadiness`.
- `evaluateFinanceLedgerIntegrity`.
- `evaluateFinanceOperationPolicy`.
- `SupabaseFinanceRepository` con writes bloqueados por defecto y mutaciones únicamente mediante RPCs controlados.

La auditoría read-only de DEV confirma:
- `public.financial_movements` — BASE TABLE: ledger operacional vigente.
- `public.financial_account_balances` — VIEW derivada de `financial_accounts` + suma de `financial_movements`.
- `public.financial_accounts` — BASE TABLE: registro de cuentas.
- `public.cash_closures` — BASE TABLE: registro de cierres.
- `lihen_private.financial_write_operations` — BASE TABLE: journal privado de idempotencia/auditoría de operaciones controladas.
- `lihen_private.financial_ledger_entries` — BASE TABLE: evidencia financiera legacy/histórica; no autoridad operacional.
- `lihen_private.legacy_financial_account_snapshots` — BASE TABLE: snapshots legacy/históricos; no autoridad operacional.

Los RPCs controlados existentes son:
- `create_financial_account_controlled`
- `record_expense_controlled`
- `transfer_financial_funds_controlled`
- `reverse_financial_movement_controlled`
- `record_cash_closure_controlled`

Los RPCs de gasto, transferencia y reversión escriben `public.financial_movements`; la vista `public.financial_account_balances` deriva su saldo de esa tabla. El journal privado registra operación/idempotencia, no saldo financiero.

## Autoridad consolidada

1. **Único ledger operacional canónico:** `public.financial_movements`.
2. **Saldo operacional:** se deriva mediante `public.financial_account_balances`; no constituye otro ledger.
3. **Mutaciones:** pasan por los RPCs controlados existentes. La aplicación no realiza writes directos a tablas financieras.
4. **Journal privado:** `lihen_private.financial_write_operations` es control/idempotencia, no ledger de movimientos.
5. **Legacy:** `lihen_private.financial_ledger_entries` y `lihen_private.legacy_financial_account_snapshots` se conservan como evidencia histórica. No vuelven a ser autoridad operacional.
6. **Tercer ledger:** prohibido.

## Delta implementado

Se agrega un contrato puro `finance-authority.ts` que:
- nombra explícitamente cada relación y su rol;
- marca exactamente una autoridad operacional;
- marca legacy como `historicalEvidenceOnly`;
- declara que ningún write directo desde aplicación está autorizado;
- documenta los RPCs de write controlado;
- incluye un guard estructural puro contra autoridad múltiple o promoción de legacy.

No se modifica el modelo contable ni las reglas de readiness, integridad, reversión, transferencias o cierres.

## Fuera de alcance

- nuevas tablas, vistas, SQL, migraciones, triggers o RPCs;
- borrado/migración de datos legacy;
- cambios de RLS;
- writes directos de Supabase;
- nuevo ledger, shadow ledger o tercer ledger;
- UI;
- Intelligence Core;
- inventario, compras, ventas, pricing o publishing;
- PROD.

## Definition of Done

GAP-030 solo puede declararse DONE / PASS cuando:
1. pruebas objetivo de Finance authority pasan;
2. pruebas de arquitectura pasan;
3. typecheck/lint/build/full quality gate pasan;
4. staging contiene únicamente el delta autorizado;
5. `git diff --cached --check` pasa;
6. commit y push a `next-phase` quedan verificados;
7. local HEAD y remote HEAD coinciden en SHA de 40 caracteres;
8. continuidad oficial se actualiza mediante lectura fresca + write con precondición de revisión + readback;
9. se registra el recovery point resultante.

Hasta entonces: **GAP-030 EN VALIDACIÓN / NO CERRADO**.
