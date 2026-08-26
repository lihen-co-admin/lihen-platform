# FASE 6.2 — Operation Contract Validation Foundation

Fecha: 2026-08-26

## Resultado DEV

`FASE 6.2: PASS`

Este corte incorpora validación estructural del payload antes de cualquier
futura ejecución real.

## Evidencia DEV

- contratos administrativos: 14
- backing RPCs encontrados: 14/14
- RPCs con `p_operation_key` como primer argumento: 14/14
- contratos con metadata de payload: 14/14
- operaciones todavía con ejecución deshabilitada: 14/14
- funciones controladas de contrato/validación: 2/2
- STYLE activos: 40
- STYLE visibles: 0

## Objetos incorporados

- `lihen_private.control_center_operation_contract_registry`
- `public.get_control_center_operation_contracts_controlled()`
- `public.validate_control_center_operation_payload_controlled(...)`
- `lihen_private.phase6_2_operation_contract_validation_readiness`
- gate `6.2`
- `PHASE6_2_OPERATION_CONTRACT_VALIDATION_FOUNDATION_V1`

## Qué resuelve

La plataforma ya no depende solamente de un textarea JSON libre para conocer la
forma esperada de una operación. El contrato se obtiene del RPC controlado real
de respaldo y expone los argumentos esperados, identificando cuáles son
obligatorios y cuáles poseen default.

Antes de PREVIEW se puede validar:

- que el payload sea un objeto JSON;
- que no falten argumentos obligatorios;
- que no existan claves inesperadas;
- que `p_operation_key` permanezca fuera del payload;
- que el backing RPC exista;
- que la ejecución siga deshabilitada.

## Invariantes

- este corte NO agrega EXECUTE;
- no llama ningún RPC de negocio;
- no modifica Product Master;
- no cambia precios ni inventario;
- no crea pedidos, compras, gastos o transferencias;
- las 14 operaciones siguen `execution_enabled=false`;
- STYLE continúa oculto;
- producción no fue tocada.

## Siguiente paso

Después de validar y versionar este CUT, Control Center puede consumir el
registro de contratos y bloquear PREVIEW cuando el payload no cumple la firma.
Ese será el siguiente corte de integración antes de considerar cualquier gate
de ejecución real.
