# FASE 5.5 — Storefront Home, hero, campañas y marcas

## Objetivo

Reemplazar la portada provisional de FASE 5.3 por una Home editorial de LIHEN.CO inspirada en `LIHEN_WEB_RENACER`, sin reintroducir sus fuentes de datos legacy.

## Alcance implementado

- Hero/carrusel editorial accesible con pausa por interacción y respeto por `prefers-reduced-motion`.
- Reutilización controlada de banners institucionales y assets visuales del storefront legacy como referencia de identidad, no como fuente de datos.
- Accesos editoriales a Beauty Care, Style y marcas.
- Campaña Beauty Care con composición visual similar al storefront histórico.
- Carrusel horizontal de marcas con controles accesibles.
- Marcas y conteos tomados de productos `ACTIVE` y `visible_on_website = true` verificados en DEV el 2026-08-24.
- Sección Style editorial sin afirmar disponibilidad canónica de productos Style mientras la proyección publicada no los incluya.
- Sección de experiencia LIHEN y footer estructurado.

## Decisiones arquitectónicas

- `site-shell.ts` queda como composition root visual, sin contenido de Home embebido.
- `home-page.ts` encapsula render e interacciones de Home.
- `site-footer.ts` encapsula el footer.
- `home.css` concentra estilos propios de Home; `shell.css` vuelve a responsabilidades de shell.
- No se usa `products.js`, CSV, `catalog_public` legacy ni precios/stock hardcodeados.
- Los conteos de marca son evidencia editorial de este corte; el filtrado y lectura dinámica del catálogo se implementan en FASE 5.7.

## Fuera de alcance

- Product cards/carruseles canónicos: FASE 5.6.
- Search/filter/pagination y filtros reales por marca: FASE 5.7.
- Product detail/galería/variantes: FASE 5.8.
- Selección/WhatsApp: FASE 5.9.
