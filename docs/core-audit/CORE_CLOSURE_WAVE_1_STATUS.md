# Core Closure Wave 1 — Status

Baseline: `10e5098`

Applied in Supabase DEV and represented in repository migrations:

- CORE 03 — Supplier foundation: PASS
- CORE 05 — Purchases / supplier invoices foundation: PASS
- CORE 06 — Inventory domain closure: PASS
- CORE 07 — Versioned catalog foundation: PASS

No legacy rows were imported by these foundations. Live verification after migration:

- suppliers: 0
- supplier_products: 0
- purchases: 0
- purchase_items: 0
- supplier_invoices: 0
- catalog_versions: 0
- catalog_entries: 0
- existing Product Master: 952, unchanged

Updated 02→15 matrix:

| # | Requirement | Status after Wave 1 |
|---|---|---|
| 02 | Product Master | PASS |
| 03 | Suppliers | PASS |
| 04 | Price history | PASS |
| 05 | Purchases / invoices | PASS |
| 06 | Inventory | PASS |
| 07 | Catalog | PASS |
| 08 | Event model | PARTIAL |
| 09 | Repository contracts | PASS |
| 10 | Domain events | PARTIAL |
| 11 | Strategies | PARTIAL |
| 12 | Import adapters | PASS |
| 13 | Allowed states | PASS |
| 14 | Reuse/adapt/remove matrix | PENDING |
| 15 | Three-project migration plan | PARTIAL |

Next closure wave: 08 + 10 + 11, then 14 + 15.
