# TANDA 11 — Public Experience · Intended Files
Fecha: 2026-08-28
Estado: CLOSED / PASS

## CUT 1
- apps/storefront/src/components/public-experience-state.ts
- apps/storefront/src/components/catalog-page.ts
- apps/storefront/src/components/gifts-page.ts
- apps/storefront/tests/public-experience-state.test.ts
- docs/TANDA11_PUBLIC_EXPERIENCE_CUT1_2026-08-28.md

## CUT 2
- apps/storefront/src/components/public-navigation-state.ts
- apps/storefront/src/components/site-header.ts
- apps/storefront/src/styles/navigation.css
- apps/storefront/tests/public-navigation-state.test.ts
- docs/TANDA11_PUBLIC_EXPERIENCE_CUT2_2026-08-28.md

## CUT 3
- apps/storefront/src/components/product-gallery-state.ts
- apps/storefront/src/components/product-page.ts
- apps/storefront/src/components/product-detail.ts
- apps/storefront/src/styles/products.css
- apps/storefront/tests/product-gallery-state.test.ts
- docs/TANDA11_PUBLIC_EXPERIENCE_CUT3_2026-08-28.md

## CUT 4
- docs/TANDA11_PUBLIC_EXPERIENCE_CUT4_CLOSURE_2026-08-28.md
- docs/TANDA11_PUBLIC_EXPERIENCE_INTENDED_FILES_2026-08-28.md

## Invariantes
- La experiencia pública no muta dominio.
- Estados públicos accesibles y consistentes.
- Navegación móvil predecible.
- Producto y ficha modal comparten reglas de galería.
- Foco se restaura al cerrar diálogos.
- Touch targets, reduced motion y forced colors.
- No se modifica publicación canónica ni eligibility.
- No PROD.

## Packaging metadata
`APPLY_MANIFEST.txt` es metadata del paquete y no debe incluirse en staging salvo decisión explícita.
