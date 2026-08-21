# FASE 1.20.2 — Controlled Taxonomy Import Foundation

## Objetivo

Preparar la creación controlada de la taxonomía canónica aprobada sin tocar productos y sin habilitar todavía el write cutover.

## Fuente de autoridad

Run de aprobación taxonómica V1:

- `run_id`: `320706a7-e345-5936-892a-d01727ad0afb`
- 46 marcas aprobadas.
- 5 categorías explícitas aprobadas.
- Decisión: `APPROVE_NEW_ENTITY`.

## Flujo

`APPROVAL → PREVIEW → CONFLICT GATE → CONTROLLED IMPORT → AUDIT`

La función `lihen_private.preview_taxonomy_import(run_id)` es el dry-run autoritativo.

Clasificaciones:

- `READY_CREATE`: aprobado y no existe un normalized name equivalente.
- `ALREADY_EXISTS`: ya existe la entidad canónica equivalente; no se duplica.
- `CONFLICT_NORMALIZED_NAME`: más de una aprobación colisiona bajo la misma identidad normalizada.

## Operación controlada

`public.import_approved_taxonomy_controlled(operation_key, run_id)`:

- exige `auth.uid()` real;
- exige `OWNER|ADMIN + ACTIVE`;
- usa idempotencia por `operation_key`;
- serializa el import;
- aborta ante conflictos;
- crea solo marcas/categorías `READY_CREATE`;
- no toca `products`;
- registra resultado en `lihen_private.taxonomy_import_operations`.

## Gate

En esta fase `EXECUTE` permanece revocado para `anon` y `authenticated`.

No ejecutar el import hasta una fase explícita de cutover.
