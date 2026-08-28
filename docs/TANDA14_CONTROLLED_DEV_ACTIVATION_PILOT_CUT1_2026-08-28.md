# TANDA 14 — Controlled DEV Activation Pilot
## CUT 1 — DEV Activation Preflight
Fecha: 2026-08-28

## Objetivo
Crear un gate previo a cualquier primera mutación real en DEV.

Este CUT NO:
- modifica `.env`;
- cambia ningún `VITE_*_WRITE_MODE`;
- ejecuta RPCs;
- habilita dispatch;
- habilita canary;
- implementa EXECUTE;
- toca PROD.

## Evidencia heredada
Las composiciones existentes exponen write modes separados para Product Master,
Inventory, Suppliers, Purchases, Orders, Sales y Finance. Los repositorios Supabase
mantienen `controlledWriteEnabled` apagado salvo configuración explícita.

El control plane sigue separado de los writes de dominio:
- operation catalog exige `executionEnabled=false`;
- release permanece HELD;
- dispatch permanece disabled;
- canary permanece disabled con presupuesto 0;
- final release permanece no autorizado.

## Gate de preflight
Antes de habilitar un único modo `controlled`, el dominio candidato debe demostrar
explícitamente:

1. Supabase DEV confirmado.
2. Modo controlled explícito y limitado al dominio candidato.
3. RPC/command controlado exacto confirmado.
4. RLS/autorización confirmada.
5. Trazabilidad/audit confirmada.
6. Idempotencia/operation key confirmada.
7. Plan de compensación o reversión confirmado.
8. Fixture DEV aislado confirmado.
9. PROD explícitamente intacto.

Si falta cualquiera, el resultado es `EVIDENCE_INCOMPLETE`.

## Fuera del piloto
Siempre son `NOT_A_PILOT_TARGET` en TANDA 14 CUT 1:
- OPERATION_DISPATCH;
- CANARY;
- FINAL_RELEASE;
- PRODUCTION.

## Próximo CUT
CUT 2 debe inspeccionar un solo dominio candidato y recopilar evidencia concreta.
No se habilitará ningún flag hasta que el preflight de ese dominio esté completo.
