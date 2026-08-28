# TANDA 1 — LIHEN Admin Foundation · CUT 4

Fecha: 2026-08-27

## Alcance

Aplicación de la Admin Foundation a las slices sensibles de comercio y finanzas:

- Ventas / POS
- Caja y finanzas

## Cambios

- `SalesPage.tsx` deja de presentar la slice como una pantalla de fase técnica y adopta `AdminPageHero`, `SummaryStrip`, `OperationalNotice` e `IntelligencePanel`.
- Se separan helpers, carga, transformación de líneas y comandos para reducir densidad del componente y facilitar refactor posterior.
- POS muestra total preparado antes de confirmar, sin alterar el flujo de dominio.
- Intelligence de ventas permanece `READ ONLY` y detecta precondiciones: cuenta financiera, Product Master y pedidos elegibles.
- `FinancePage.tsx` adopta la misma Foundation y hace explícito que el saldo es derivado del ledger.
- Se añaden métricas de cuentas, saldo derivado, ingresos por venta, egresos y cierres con diferencia.
- Intelligence financiera detecta ausencia de cuentas, ausencia de cuentas activas y diferencias de cierre sin corregir saldos automáticamente.
- Se conserva la reversión por contramovimiento y se mantienen fuera de esta UI las reversas de ventas/transferencias que requieren flujo de dominio completo.

## Invariantes preservados

- No hay writes directos de UI a tablas.
- No se toca producción.
- No se habilita final execution/canary/dispatch.
- Venta completada mantiene operación controlada sobre inventario + finanzas.
- Ledger financiero permanece append-only en su semántica: reversión agrega historia, no la elimina.
- LIHEN Intelligence es advisory/read-only en esta tanda.

## Criterios rectores

1. Fundamentos Generation / Guías Visuales: flujo legible, funciones claras, tipos y capas.
2. Refactoring.Guru: reducción de densidad, responsabilidades más visibles, reutilización de patrones UI.
3. Invariantes LIHEN: Product Master, ledger, trazabilidad, operación controlada.
4. Seguridad/governance: comandos existentes y flags; sin bypass.
5. UX LIHEN: copy operativo, jerarquía visual y estados comprensibles.
6. QA: `git diff --check`, `pnpm check`, `git status` en checkpoint local.
