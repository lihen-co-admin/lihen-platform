# FASE 1.27 — Worker Node Types Fix

Fecha: 2026-08-21
Estado: CORRECCION APLICADA — VALIDACION MANUAL COMPLETA PENDIENTE

## Hallazgo

El gate `pnpm check` fallaba en `apps/workers/src/health.ts` con TypeScript TS2591 porque el workspace usa `process.env.NODE_ENV` pero su `tsconfig.json` no declaraba los tipos de Node.

## Correccion aplicada

1. `apps/workers/package.json` ya contiene `@types/node` como devDependency.
2. `pnpm-lock.yaml` ya contiene la resolucion de `@types/node` generada con pnpm 10.15.0.
3. `apps/workers/tsconfig.json` declara explicitamente:

```json
"types": ["node"]
```

No se modifico `health.ts` y no se agregaron declaraciones globales artificiales.

## Validacion realizada en el artefacto

El typecheck aislado del workspace fue ejecutado con:

```text
node node_modules/typescript/bin/tsc -p apps/workers/tsconfig.json --noEmit
```

Resultado: PASS (exit code 0).

## Gate pendiente en el equipo autorizado

Ejecutar bajo el runtime contractual del repositorio:

```text
Node 24.x
pnpm 10.15.0
```

Luego:

```bash
pnpm install --frozen-lockfile
pnpm check
```

No hacer commit/push hasta que `pnpm check` finalice en PASS.
