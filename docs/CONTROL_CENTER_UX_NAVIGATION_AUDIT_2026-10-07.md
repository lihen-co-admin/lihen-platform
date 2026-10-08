# CONTROL CENTER UX / NAVIGATION AUDIT — 2026-10-07

## Scope

Cross-surface UX/navigation audit for LIHEN Control Center · DEV.

This phase does not broaden business capabilities. It validates and improves
navigation visibility, focus, internal destinations and browser feedback.

## Required surfaces

- Dashboard `/`
- Products `/products`
- Brands `/brands`
- Categories `/categories`
- Catalogs `/catalogs`
- Inventory `/inventory`
- Suppliers `/suppliers`
- Purchases `/purchases`
- Orders `/orders`
- Customers / Benefits `/customers/benefits`
- Sales / POS `/sales`
- Finance `/finance`
- Public Hub `/content/public-hub`
- Content and calendar `/content/social`
- Conversations / WhatsApp `/conversations`
- LIHEN Cloud `/cloud`
- Assistant `/assistant`
- Operations / integrity `/operations`
- Auth + RLS Probe `/dev-auth-probe`
- WhatsApp Preflight `/dev-whatsapp-preflight`

Additional registered routes remain covered by the router and architecture suite.

## Confirmed UX defect

Supplier `Editar` loaded the correct record into the Supplier Master form but
left the viewport at the table, making the action appear inactive.

Classification: FIX.

## Implemented pattern

Supplier edit now:

1. loads the selected supplier;
2. keeps controlled-write idempotency intact;
3. scrolls Supplier Master into view with smooth behavior;
4. focuses the business-name field without causing a second scroll;
5. uses scroll margin so the form is not hidden under the Control Center header.

The retry operation key remains stable after a failed submit and is cleared
only after success, cancel or explicit record change.

## Navigation contracts

Architecture tests verify:

- HashRouter remains active;
- required Control Center routes are registered;
- sidebar destinations map to registered routes;
- static Intelligence `targetRoute` destinations map to registered routes;
- hardcoded root-relative internal `href` navigation is rejected;
- Supplier browser idempotency remains intact;
- Supplier edit has explicit scroll/focus wiring;
- no Supplier DELETE path is introduced.

## Manual smoke requirement

The final manual smoke must traverse every principal sidebar surface and exercise
visible navigation/interaction without enabling capabilities outside their
existing DEV policy.

For each surface classify observed interaction as:

- PASS
- FIX
- BROKEN
- DEAD
- EXTERNAL
- HELD / AMBIGUOUS

Only clearly intended UX/navigation defects should be changed in this phase.

## Supplier pilot hard-close

The fixture:

`DEV UI PILOT SUPPLIER 2026-10-07 2042`

must remain ACTIVE during the cross-surface audit.

Only after the complete manual smoke is accepted:

1. open Suppliers;
2. edit that exact fixture;
3. change ACTIVE -> INACTIVE;
4. save through the controlled browser flow;
5. do not physically DELETE;
6. verify database state, CREATE/UPDATE operations and audit trail read-only;
7. confirm no duplicate fixture exists.

## Governance

- DEV only.
- PROD HOLD.
- `main` untouched.
- scheduler OFF.
- canary OFF.
- dispatch OFF.
- final execution OFF.
- WhatsApp SEND OFF.
- `WHATSAPP_SENDING_ENABLED=false`.
- official WhatsApp ending 4163 untouched.
- no real Meta/TikTok publication/provider calls.
- FREE_ONLY.
- no browser service-role credential.
- GENERATED != OFFICIAL.
- RECOMMENDATION != EXECUTION.
- MESSAGE GENERATION != SENDING.
- PROVIDER ACCEPTANCE != PUBLICATION SUCCESS.

## Validation

Pending final quality gate and manual cross-surface smoke.

## Final manual smoke

Cross-surface manual smoke completed successfully in LIHEN Control Center · DEV.

Principal surfaces reviewed:

- Dashboard
- Products
- Brands
- Categories
- Catalogs
- Inventory
- Suppliers
- Purchases
- Orders
- Customers / Benefits
- Sales / POS
- Finance
- Public Hub
- Content / calendar
- Conversations / WhatsApp
- LIHEN Cloud
- Assistant
- Operations / integrity
- Auth + RLS Probe
- WhatsApp Preflight

Observed result: PASS for the reviewed UX/navigation flow.

## Supplier browser DEV pilot hard close

Fixture:

`DEV UI PILOT SUPPLIER 2026-10-07 2042`

Final state:

`INACTIVE`

Read-only DEV verification confirmed:

- exact fixture count: 1
- CREATE_SUPPLIER operations: 1
- UPDATE_SUPPLIER operations: 1
- operational audit CREATE_SUPPLIER events: 1
- operational audit UPDATE_SUPPLIER events: 1
- no physical DELETE
- no duplicate fixture

The browser-controlled evidence path is therefore closed:

Control Center UI
→ controlled Supplier RPC
→ durable read
→ controlled compensation
→ audit trail

## Final governance

- PROD HOLD
- main untouched
- scheduler OFF
- canary OFF
- dispatch OFF
- final execution OFF
- WhatsApp SEND OFF
- official WhatsApp ending 4163 untouched
- no real social publication/provider execution
- FREE_ONLY
