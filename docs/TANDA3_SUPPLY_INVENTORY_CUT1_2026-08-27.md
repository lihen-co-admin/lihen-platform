# TANDA 3 — Supply & Inventory · CUT 1

Fecha: 2026-08-27
Estado: READY FOR LOCAL QA

## Objetivo

Cerrar el contrato operativo inicial entre Compras e Inventario sin mezclar responsabilidades de dominio ni habilitar automatizaciones inseguras.

## Invariantes reafirmados

1. `DRAFT` de compra no modifica inventario ni finanzas.
2. Confirmar compra representa compromiso de abastecimiento; no equivale a recepción física.
3. La recepción física es la causa auditable para materializar unidades recibidas en el ledger de inventario.
4. `PENDING_IN`, `ON_HAND` y `RESERVED` no se editan como simples números: son saldos derivados de movimientos.
5. Un ajuste manual de inventario solo corrige diferencias físicas reales de `ON_HAND` y requiere motivo trazable.
6. Recibir mercancía no significa pagar al proveedor. El pago pertenece al dominio financiero.
7. LIHEN Intelligence permanece read-only y no ejecuta transiciones.

## Cambios

### Purchase Supply Readiness

Se agregó la política determinística `evaluatePurchaseSupplyReadiness()` en `@lihen/procurement`.

Evalúa:

- unidades solicitadas;
- unidades recibidas;
- unidades pendientes;
- porcentaje de recepción;
- atraso frente a fecha esperada;
- posibilidad de confirmar;
- posibilidad de recibir;
- bloqueos estructurales.

La política no escribe en base de datos ni sustituye los gates/RPC controlados.

### Purchase Detail

`PurchaseDetailPage` fue migrada a LIHEN Admin Foundation:

- `AdminPageHero`;
- `SummaryStrip`;
- `OperationalNotice`;
- `IntelligencePanel`;
- readiness de abastecimiento visible;
- flujo `DRAFT → CONFIRMED → RECEIPT` expresado en lenguaje operativo;
- prevención UI de confirmación cuando la compra tiene bloqueos;
- recepción limitada a cantidades todavía pendientes;
- separación explícita entre recepción física y pago al proveedor.

### Inventory traceability

`InventoryPage` ahora permite inspeccionar el historial inmutable por producto usando el query handler ya existente.

Se muestran:

- fecha;
- bucket (`ON_HAND`, `RESERVED`, `PENDING_IN`);
- delta;
- motivo;
- referencia externa;
- notas.

La trazabilidad es read-only. No se introdujo una vía alternativa para alterar saldos.

### Intelligence

Se reforzaron señales para:

- compras vencidas pendientes de recepción;
- recepciones parciales;
- borradores listos o bloqueados;
- PENDING_IN;
- stock consumido por reservas;
- buckets negativos como señal crítica de integridad.

## Tests añadidos

`packages/procurement/tests/purchase-supply-readiness.test.ts`

Cobertura esperada:

- borrador válido;
- compra confirmada vencida;
- recepción parcial;
- recepción completa;
- compra sin líneas.

## Seguridad / governance

- PROD no fue tocado.
- No se habilitó execution, dispatch ni canary real.
- No se añadieron escrituras directas desde UI a tablas de negocio.
- Los writes existentes siguen pasando por repositorios/RPC controlados.
- No se modifica ledger histórico.

## Definition of Done del CUT

Pendiente de validación local:

```bash
git diff --check
pnpm check
git status
```

Esperado: typecheck, lint, tests, architecture boundaries y builds PASS.
