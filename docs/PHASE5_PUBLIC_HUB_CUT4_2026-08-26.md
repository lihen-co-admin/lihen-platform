# FASE 5 · Public Hub CUT 4 · Public projection hardening

## Scope

This cut hardens the public edge of the Hub without rebuilding the foundation or duplicating Product Master data.

- Storefront validates the shape of the controlled RPC projection before rendering.
- Unknown/malformed rows are ignored instead of being trusted blindly.
- Public blocks are rendered in deterministic `sort_order` order.
- The Hub stack uses a semantic section instead of a navigation landmark that also contained editorial/non-link blocks.
- Product blocks continue to use canonical name, brand, price, availability and WEB_CARD media from the public projection.
- Rendering tests cover canonical product output and escaping of public text.
- Domain URL rules now distinguish navigation URLs from image URLs.
- DEV database constraints provide defense-in-depth for safe URL protocols.

## URL contract

- `target_url`: `http`, `https`, `mailto`, `tel`.
- `image_url`: `http`, `https` only.
- Product URLs and product media remain generated/resolved from canonical product data by the controlled public RPC.

## Safety / continuity

- FASE 5 remains active; this does not start FASE 6.
- No production write is part of this cut.
- No new storage bucket.
- No Product Master, inventory, price or product-image duplication.
- Existing Public Hub status/scheduling model is unchanged.

## Validation gate

Run locally after copying the cut:

```bash
git diff --check
pnpm check
git status
```

Do not stage or commit until the full gate passes.
