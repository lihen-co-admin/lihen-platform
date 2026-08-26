# FASE 6.1B — Dry Run and Confirmation Foundation

Fecha: 2026-08-26

## Resultado DEV

`FASE 6.1B: PASS`

Este corte introduce la infraestructura de PREVIEW y CONFIRM sin habilitar
ninguna ejecución de negocio.

## Métricas verificadas

- catálogo administrativo: 14 operaciones
- operaciones todavía deshabilitadas para ejecución: 14/14
- operaciones que requieren confirmación: 14/14
- RPCs de PREVIEW/CONFIRM presentes: 2/2
- intents creados durante la migración: 0
- STYLE activos: 40
- STYLE visibles: 0

## Objetos incorporados

- `lihen_private.control_center_operation_intents`
- `public.prepare_control_center_operation_controlled(...)`
- `public.confirm_control_center_operation_controlled(...)`
- `lihen_private.phase6_1b_dry_run_confirmation_readiness`
- gate `6.1B`
- `PHASE6_1B_DRY_RUN_CONFIRMATION_FOUNDATION_V1`

## Seguridad e idempotencia

PREVIEW registra solo metadata privada de intención. No llama al RPC de negocio
subyacente y siempre devuelve `execution_enabled = false`.

CONFIRM exige OWNER/ADMIN activo, mismo actor, `intent_id`, token de confirmación
correcto y una intención no expirada. Una confirmación válida cambia únicamente
el estado privado de la intención a `CONFIRMED`.

Un `operation_key` no puede reutilizarse con otra operación o payload. Las
intenciones expiran a los 30 minutos. Las tablas privadas no se exponen
directamente a `authenticated` ni `anon`.

## Invariantes

- no existe un RPC de EXECUTE en este CUT;
- las 14 operaciones permanecen deshabilitadas;
- no se mutó Product Master;
- no se cambió precio ni inventario;
- no se generaron pedidos, compras o movimientos financieros;
- STYLE permanece oculto;
- producción no fue tocada.

## Siguiente paso

Tras validar y versionar este CUT, queda pendiente conectar el contrato de
6.1A/6.1B al Control Center y continuar con 6.1C — Operation Audit Timeline.
La habilitación real de EXECUTE debe permanecer como gate separado.
