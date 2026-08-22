# CORE 08 / 10 / 11 — Events, Domain Events and Strategies

Baseline: `f3736bd`

## CORE 08 — Modelo de eventos

- `public.domain_events` is the canonical immutable event store.
- `lihen_private.domain_event_outbox` is the private delivery queue.
- `lihen_private.append_domain_event(...)` is service-role only.
- No historical events are fabricated or backfilled.
- Browser roles have no direct INSERT/UPDATE/DELETE permission.

## CORE 10 — Eventos de dominio

The generic `DomainEvent` contract is complemented with:

- `DomainEventBus`
- `DomainEventHandler`
- `DomainEventStore`
- `InMemoryDomainEventBus`
- concrete event contracts for Product, Supplier, Procurement, Inventory and Catalog.

Concrete event types introduced:

- PRODUCT_CREATED
- PRODUCT_SALE_PRICE_CHANGED
- SUPPLIER_REGISTERED
- PURCHASE_CREATED
- SUPPLIER_INVOICE_REGISTERED
- INVENTORY_MOVEMENT_RECORDED
- CATALOG_VERSION_PUBLISHED

This closure defines contracts and infrastructure. Existing historical rows are not retroactively converted into events.

## CORE 11 — Estrategias

- Generic `Strategy<TContext, TResult>` contract.
- `StrategyRegistry` for explicit deterministic selection by key.
- Conservative product import decision strategy keeps ambiguous identities in REVIEW rather than inventing a match.

## Security

- Event append is not exposed to `authenticated`.
- Event rows are immutable after append.
- Outbox is private and service-role only.
- OWNER/ADMIN may read the event store through RLS; other signed-in roles cannot.
