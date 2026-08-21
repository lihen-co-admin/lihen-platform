# FASE 1.20.3 — Controlled Taxonomy Import DEV Cutover

Date: 2026-08-21
Project: `lihen-platform-dev`

## Scope

Execute exactly one approved canonical taxonomy import in DEV while keeping products untouched.

## Preflight

- Canonical reconciliation run: `320706a7-e345-5936-892a-d01727ad0afb`
- Preview rows: 51
- READY_CREATE: 51
- ALREADY_EXISTS: 0
- Conflicts: 0
- Active OWNER profiles: 1
- brands: 0
- categories: 0
- products: 0

## Controlled cutover

`authenticated` received temporary EXECUTE on `public.import_approved_taxonomy_controlled(text, uuid)`.

Operation key:

`FASE_1_20_3_TAXONOMY_IMPORT_2026_08_21_V1`

First execution result:

- brands_created: 46
- categories_created: 5
- already_existing: 0
- preview_count: 51

## Idempotency defect found and fixed

The first retry exposed `LIHEN_TAXONOMY_IMPORT_OPERATION_CONFLICT` because the original fingerprint depended on mutable preview counts. After the first import, rows legitimately changed from READY_CREATE to ALREADY_EXISTS.

Migration `20260821164315_fix_taxonomy_import_idempotency` changed the algorithm so a completed operation is resolved first by stable request identity: operation key + actor + run. Mutable preview state is evaluated only for a new operation.

Retrying the same operation key after the fix returned exactly the original result snapshot and created no new rows.

## Final state

- brands: 46
- categories: 5
- products: 0
- taxonomy import operations: 1
- post-import preview: 51 ALREADY_EXISTS, 0 READY_CREATE, 0 conflicts
- duplicated normalized brand names: 0
- duplicated normalized category names: 0
- anon RPC EXECUTE: false
- authenticated RPC EXECUTE: false
- authenticated direct brand INSERT: false
- authenticated direct category INSERT: false

The cutover gate was closed again by migration `20260821164343_disable_controlled_taxonomy_import_after_dev_cutover`.

No product, image, price, inventory or Storage object was modified by this phase.
