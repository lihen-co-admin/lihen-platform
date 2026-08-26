# FASE 6.1 — Control Center Integration CUT 1

Fecha: 2026-08-26
Base revisada: `fca2f65`

## Objetivo

Conectar los contratos ya versionados de 6.1A, 6.1B y 6.1C a la experiencia real del Control Center sin habilitar ejecución de negocio.

## Integración implementada

La ruta existente `/operations` evoluciona de una pantalla de observabilidad FASE 2 a una consola administrativa controlada que conserva la observabilidad anterior y añade:

- catálogo 6.1A desde `get_control_center_operation_catalog_controlled()`;
- PREVIEW 6.1B desde `prepare_control_center_operation_controlled(...)`;
- CONFIRM 6.1B desde `confirm_control_center_operation_controlled(...)`;
- timeline 6.1C desde `get_control_center_operation_audit_timeline_controlled(...)`.

## Seguridad de UI

- No existe botón `EXECUTE`.
- La consola presenta explícitamente `execution_enabled=false`.
- PREVIEW acepta únicamente un objeto JSON.
- CONFIRM solo se habilita para una intención `PREVIEWED`, con confirmación requerida, token presente y ejecución deshabilitada.
- El catálogo muestra riesgo, dominio, acción y estado de ejecución.
- La UI no escribe directamente sobre tablas privadas.
- La bitácora histórica FASE 2 se conserva en un bloque desplegable.

## Archivos del CUT

- `apps/control-center/src/composition/operations.ts`
- `apps/control-center/src/pages/OperationsPage.tsx`
- `apps/control-center/src/pages/operation-console-policy.ts`
- `apps/control-center/tests/operation-console-policy.test.ts`
- `apps/control-center/src/styles/app.css`
- `docs/PHASE6_1_CONTROL_CENTER_INTEGRATION_CUT1_2026-08-26.md`

## Pruebas añadidas

Se añade una prueba unitaria de política para cubrir:

- payload JSON de PREVIEW;
- clasificación visual de riesgo;
- condición segura para CONFIRM;
- invariante de catálogo sin ejecución habilitada.

## Estado de ejecución

Este CUT conecta lectura y preparación administrativa. No habilita el RPC de negocio subyacente ni introduce una vía de EXECUTE.

## Validación requerida

En el repositorio local ejecutar:

```bash
git diff --check
pnpm check
git status
```

No usar `git add .` y no versionar hasta revisar el resultado completo.
