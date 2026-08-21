# Bootstrap validation — 2026-08-20

## Ejecutado en el entorno de construcción

- Estructura física creada: **90 archivos**.
- JSON/tsconfig/package manifests: **válidos**.
- `node --check` sobre configuraciones JS: **válido**.
- Arquitectura estática básica (packages→apps, domain→React/Supabase, storefront→dominios privados): **sin violaciones**.
- `packages/shared`: `tsc --noEmit` **OK** con el compilador disponible en el entorno.
- `packages/core`: `tsc --noEmit` **OK** con el compilador disponible en el entorno.

## Limitaciones del entorno

El entorno de construcción dispone de Node 22 y no trae pnpm. El acceso al registro npm no respondió dentro del tiempo disponible, por lo que no fue posible instalar React/Vite/Vitest/Playwright/Zod/Supabase ni generar un `pnpm-lock.yaml` real.

El proyecto mantiene **Node 24 LTS** como requisito objetivo mediante `.nvmrc` y `engines`. La primera ejecución en una máquina con acceso al registro debe ser:

```bash
corepack enable
pnpm install
pnpm check
pnpm test:e2e
```

Después del primer `pnpm install`, se debe confirmar `pnpm-lock.yaml` en Git y cambiar CI de `--no-frozen-lockfile` a `--frozen-lockfile`.

## Seguridad

No se conectó producción, no se ejecutaron migraciones y no se copiaron datos reales de LIHEN al bootstrap.
