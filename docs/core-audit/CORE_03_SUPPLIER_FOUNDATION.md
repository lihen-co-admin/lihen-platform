# CORE 03 — Supplier Foundation

Baseline audited: `10e5098`.

## Scope

This slice closes the missing canonical supplier foundation without importing or guessing any legacy supplier identity.

Implemented:

- canonical `Supplier` domain model;
- conservative statuses `ACTIVE | INACTIVE`;
- `SupplierRepository` contract;
- `SupplierProductRepository` contract;
- canonical `public.suppliers` table;
- canonical `public.supplier_products` relationship to Product Master;
- RLS read access restricted to authenticated ACTIVE administrative profiles;
- no browser write grants;
- no legacy cutover or identity matching in this migration.

## Security

Supplier information is administrative data. `anon` has no access. Authenticated reads require an ACTIVE profile with a recognized administrative role. Writes remain closed until a controlled command/RPC is designed and tested.

## Deferred deliberately

- legacy supplier reconciliation/import;
- payment/banking detail migration;
- procurement workflows;
- supplier create/update UI;
- controlled write RPCs.

Those concerns must not be mixed into the identity foundation.
