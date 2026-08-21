# ADR-001 — Monorepo modular

**Estado:** Aprobado

## Contexto
Control Center, Storefront, workers y dominios comparten contratos, pero necesitan despliegues independientes.

## Decisión
Usar un monorepo con `apps/`, `packages/` y `database/`, manteniendo límites modulares explícitos.

## Consecuencias
Un único contrato y lockfile, mejor refactor transversal y tests de arquitectura. Requiere disciplina de dependencias.
