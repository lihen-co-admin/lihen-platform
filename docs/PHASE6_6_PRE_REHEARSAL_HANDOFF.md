# FASE 6.6 — Pre-rehearsal handoff

Estado: IMPLEMENTED — pendiente de ejecución real.

## Objetivo

Crear el último gate de FASE 6 antes de FASE 7.

Este gate NO hace go-live. Solo acepta `DEV` o `STAGING` y rechaza `PRODUCTION`.

## Comando

```bash
pnpm check:storefront:pre-rehearsal
```

Requiere:

- `LIHEN_RELEASE_ENVIRONMENT=DEV` o `STAGING`;
- `LIHEN_RELEASE_MANIFEST_PATH` apuntando al manifiesto RC externo;
- worktree sin cambios inesperados;
- documentación y tooling de FASE 6 presentes;
- verificación independiente del RC en PASS.

## Cierre

FASE 6 puede considerarse cerrada únicamente cuando 6.4, 6.5 y 6.6 tengan ejecución real PASS.

FASE 7 permanece reservada para rehearsal/go-live y requiere decisión explícita. Ningún script de FASE 6 despliega ni modifica producción.
