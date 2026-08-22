# CORE 05 — Purchases / Supplier Invoices Foundation

Baseline audited: `10e5098`.

## Scope

Creates the canonical purchase and supplier-invoice model after Supplier Core exists.

Implemented:

- `Purchase`, `PurchaseItem`, and `SupplierInvoice` domain contracts;
- explicit purchase and invoice payment states;
- Repository contracts;
- `public.purchases`;
- `public.purchase_items` linked to canonical Product Master;
- `public.supplier_invoices` linked to canonical suppliers;
- RLS administrative reads;
- browser writes remain closed;
- no legacy purchase/invoice cutover.

## Boundary decisions

- inventory receipt posting is not silently performed by this model;
- financial ledger posting is not silently performed by this model;
- legacy `supplier_requests` remain evidence until a separate reconciliation step maps them;
- payment/banking information is not copied into these public tables.
