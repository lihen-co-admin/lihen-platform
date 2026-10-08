# Customer Benefits Operator Lookup UX

## Scope

This refinement replaces durable UUID entry as the primary operator interaction
for Customer Benefits.

It does not change Customer Benefit business policy, lifecycle rules, RPCs,
database schema, Creative rendering, WhatsApp behavior, or execution authority.

## Existing sources reused

The Control Center reuses existing read repositories:

- Customers through `customersComposition.repository.list()`.
- Orders through `ordersComposition.repository.list()`.
- Sales through `salesComposition.repository.list()`.

No parallel lookup repository was introduced.

## Operator flow

### Customer filtering

The operator may load active Customers and locate one by human-readable values
such as customer code, name, or phone. The selected customer's durable ID is
used internally by the existing Customer Benefits read adapter.

### Benefit issuance / redemption

The operator loads Sales and locates a sale by human-readable details such as:

- sale number;
- customer name;
- channel;
- status;
- total.

The selected sale's durable ID continues to populate the unchanged controlled
Customer Benefits RPC arguments.

### Apply / remove benefit

The operator loads Orders and locates the relevant order by:

- order number;
- customer;
- phone;
- channel;
- status.

The selected order's durable ID continues to populate the unchanged controlled
Customer Benefits RPC arguments.

## Governance

The following remain unchanged:

- OWNER / ADMIN authorization.
- Supabase DEV authority.
- `operationKey` retry/idempotency behavior.
- `benefitActionAllowed`.
- existing Customer Benefit RPC names and arguments.
- server-side commercial eligibility.
- no automatic issuance.
- no automatic redemption.
- no automatic discount application.
- no WhatsApp SEND.
- no scheduler activation.
- no PROD changes.

Human-readable lookup improves operator certainty. It does not expand execution
authority.
