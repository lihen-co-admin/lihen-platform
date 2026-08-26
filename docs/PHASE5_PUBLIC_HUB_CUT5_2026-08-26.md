# FASE 5 · Public Hub CUT 5 · Publishability + client defense-in-depth

## Scope

This cut closes two remaining hardening gaps without expanding the Hub into a CMS or duplicating Product Master data.

1. A PRODUCT block cannot enter `PUBLISHED` unless the canonical product is actually eligible for the public projection: active, web-visible, with a valid sale price and active `WEB_CARD` media.
2. The Storefront validates public projection URLs and numeric price values again at runtime before rendering.

## Server-side publication guard

`lihen_private.assert_public_hub_product_publishable(uuid)` is private and has no grants to `anon` or `authenticated`.

The controlled save/status RPCs call the guard only when a PRODUCT block is entering `PUBLISHED`. Draft, hidden and archived work remains editable without forcing premature media readiness.

The guard reads canonical Product Master/media state only. It does not mutate product visibility, price, inventory or images.

## Storefront defense-in-depth

The public payload parser now rejects:

- unsafe navigation schemes such as `javascript:`;
- unsafe image schemes such as `data:` or `mailto:`;
- non-finite or negative sale prices;
- malformed rows.

Hash routes remain supported because canonical product links are emitted as `#producto/...` by the public RPC.

Equal sort orders use `block_id` as a deterministic client-side tie-breaker.

## Control Center error clarity

Known persistence errors are translated into actionable user-facing messages. In particular, a product that is not yet publishable tells the administrator to review web visibility, sale price and `WEB_CARD` media instead of exposing an internal RPC code.

## Safety

- DEV migration only during implementation validation.
- Production untouched.
- No new Storage bucket.
- No external media ingestion.
- No Product Master mutation.
- No new contradictory publication flags.
