# FASE 6.2–6.4 — Control Center Integration CUT 1

Fecha: 2026-08-26

Este corte acumulado conecta al Control Center los contratos de payload de FASE 6.2, el guard de release de FASE 6.3 y el gate acumulado pre-execution de FASE 6.4.

## Comportamiento

- el payload se valida contra la firma real del RPC antes de PREVIEW;
- faltantes y claves inesperadas bloquean PREVIEW;
- `p_operation_key` se mantiene fuera del payload;
- el contrato esperado se muestra en la UI;
- las 14 operaciones muestran release `HELD`;
- el presupuesto de ejecución permanece en `0`;
- el entorno permitido sigue `DEV_ONLY`;
- el resumen 6.4 expone readiness acumulado;
- no existe botón ni RPC de EXECUTE en este corte.

## Seguridad

Este CUT no habilita mutaciones de negocio nuevas. Product Master, precio, inventario, pedidos, compras, finanzas, proveedores y visibilidad no se modifican desde esta integración. STYLE permanece oculto y producción no fue tocada.
