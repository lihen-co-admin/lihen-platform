# CORE 07 — Versioned Catalog Foundation

Adds an explicit catalog-version boundary rather than treating `products.visible_on_website` as the catalog itself.

The foundation stores a catalog header and product snapshots (`name`, `sale price`, visibility/order) so historical published versions can remain explainable even when Product Master changes later.

No version is created, activated, or populated by this migration. The existing 952 Product Master rows remain untouched.
