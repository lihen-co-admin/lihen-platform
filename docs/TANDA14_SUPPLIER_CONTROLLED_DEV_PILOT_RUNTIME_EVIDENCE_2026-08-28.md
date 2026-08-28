# TANDA 14 — Supplier Controlled DEV Pilot
## CUT 4 — Runtime evidence
Fecha: 2026-08-28

## Resultado
**PASS — controlled database-runtime pilot in DEV.**

The pilot was executed only against Supabase DEV project `vnmkupzptujtywnnabkp`.
PROD was not queried or mutated.

## What was proven at runtime

1. `create_supplier_controlled(...)` accepted an isolated DEV fixture under an
   authenticated ACTIVE OWNER claim context.
2. Replaying the exact create operation key returned successfully without
   creating a second supplier operation.
3. The supplier was readable after the controlled create.
4. Compensation used the existing controlled update workflow, not physical DELETE.
5. The fixture was left `INACTIVE`.
6. Replaying the exact compensation operation key returned successfully without
   creating a second update operation.
7. Exactly two supplier write-operation rows exist for the fixture:
   - one `CREATE_SUPPLIER`;
   - one `UPDATE_SUPPLIER`.
8. `public.operational_audit_log` contains exactly the corresponding supplier
   create and update events sourced from `supplier_write_operations`.

## Source guarantees verified before runtime

The deployed DEV functions are `SECURITY DEFINER`, require `auth.uid()`, require
an `ACTIVE` profile with role `OWNER` or `ADMIN`, require a non-empty operation
key, bind an existing operation key to the same actor/supplier/request
fingerprint, and persist a result snapshot.

## Compensation

The pilot intentionally did **not** physically delete the fixture. The controlled
compensation path changed it to `INACTIVE`, preserving auditability and avoiding
an ungoverned DELETE.

Final fixture state:

- business name: `DEV PILOT SUPPLIER 2026-08-28 1511`;
- status: `INACTIVE`;
- commercial use: **NO**.

## Important limitation

This proves the deployed controlled database path and its runtime idempotency,
authorization rule, compensation and audit trail.

It does **not** yet enable `VITE_SUPPLIER_WRITE_MODE=controlled` in the browser,
and it does not claim an end-to-end UI write transport test. Browser write mode
remains blocked until a separate explicit decision.

## Safety invariants preserved

- DEV only.
- No PROD access.
- No `.env` change.
- No migration.
- No physical supplier DELETE.
- No operation dispatch.
- No canary.
- No final release execution.
- No autonomous Intelligence -> Database mutation.
