# FASE 6.4 — Release tooling hardening

Estado: IMPLEMENTED — pendiente de ejecución real en el repositorio.

## Objetivo

Eliminar el warning `DEP0190` del generador de Release Candidate y evitar `shell: true`.

En Windows, el runner invoca `cmd.exe` explícitamente solo para comandos `pnpm` constantes del propio tooling. Las lecturas Git usan `execFileSync` directamente y no pasan por shell.

## Gate

- `node --check tooling/prepare-storefront-release-candidate.mjs`
- `pnpm lint`
- una ejecución real de `pnpm prepare:storefront:release-candidate`
- ausencia de `DEP0190`

No cambia datos, no ejecuta migraciones y no despliega.
