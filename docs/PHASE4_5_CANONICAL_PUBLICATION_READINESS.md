# FASE 4/5 — Publicación canónica PDF + Storefront

## Estado real

- Product Master post-cutover: 1005 productos.
- FASE 3.10: APPLIED.
- FASE 3.11: WAITING_FOR_VERIFICATION.
- FASE 4 entry gate: BLOCKED por `PHASE3_POST_VERIFICATION_NOT_PASSED`.
- Diagnósticos FASE 4: 7 PASS + 1 WARN.
- WARN: 952 productos activos preexistentes sin `current_cost`.

## Decisión de dominio sobre costo

`current_cost` NO forma parte de la política automática de publicación comercial PDF/Web. Un costo faltante es una deuda de calidad de datos y análisis de margen, no una razón suficiente para ocultar un producto cuyo precio de venta esté validado.

No inferir costos.

## Política de publicación preparada en código

`packages/catalog/src/domain/catalog-publication.ts`

Condiciones compartidas:

- producto ACTIVE;
- incluido en la versión de catálogo;
- `sale_price` válido y no negativo;
- imagen principal presente.

Condición adicional WEB:

- `visible_on_website = true`.

Esto mantiene separadas:

- existencia canónica;
- inclusión en una versión PDF;
- visibilidad web.

## Gap de reproducibilidad PDF detectado

La tabla actual `catalog_entries` congela:

- product name;
- sale price;
- visible;
- sort order.

No congela todavía imagen, marca, categoría ni otros elementos visuales/comerciales. Para un PDF totalmente reproducible se necesita definir una estrategia de snapshot antes de publicar FASE 4. Esa migración NO se crea/aplica mientras el gate de entrada siga bloqueado.

## FASE 5 Storefront

`apps/storefront` sigue siendo foundation. No reemplaza `LIHEN_WEB_RENACER` hasta tener capacidad equivalente validada, pruebas y rollback.
