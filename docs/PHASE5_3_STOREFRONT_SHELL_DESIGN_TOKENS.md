# FASE 5.3 — Storefront shell + design tokens

## Objetivo

Trasladar la identidad visual de `LIHEN_WEB_RENACER` a una base nueva, reusable y desacoplada del runtime legacy.

## Decisiones

- Se conserva `DM Sans` como tipografía de cuerpo y `Playfair Display` como display.
- Se conservan marfil/crema, nude/rosa, lila, dorado, blanco y tinta oscura como lenguaje visual.
- Se conserva un contenedor máximo de 1180 px.
- Se conserva header sticky, navegación desktop y menú mobile.
- Se estandarizan radios, sombras, espacios, botones y focus visible mediante tokens.
- El shell no importa `products.js`, CSV, `catalog_public` legacy ni scripts del ZIP.
- FASE 5.3 no implementa todavía búsqueda, filtros, mega menú, carruseles, ficha de producto ni selección.

## Arquitectura

`main.ts` solo compone el shell.

`components/site-shell.ts` contiene markup e interacción local del shell.

`styles/tokens.css` contiene las decisiones visuales reutilizables.

`styles/global.css` contiene primitives/base.

`styles/shell.css` contiene layout del Storefront base.

## Regla de continuidad

Visualmente: `LIHEN_WEB_RENACER`.

Arquitectónicamente: LIHEN Platform.

Datos: `get_storefront_products_controlled()` y futuras consultas canónicas.
