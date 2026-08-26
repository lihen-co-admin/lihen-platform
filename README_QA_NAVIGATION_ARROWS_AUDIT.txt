LIHEN — Auditoría global de flechas de navegación
Fecha: 2026-08-25

Alcance auditado:
1. Hero principal.
2. Carrusel "Compra por marcas".
3. Rieles horizontales de productos.
4. Galería Product Detail full-screen.
5. Paginaciones Catálogo/Ideas para regalar: se mantienen como navegación textual
   Anterior/Siguiente porque cumplen otra función y no deben confundirse con carruseles.

Problemas corregidos:
- Se eliminan glifos tipográficos ‹ › como icono principal: podían verse descentrados
  dependiendo de fuente/renderizado.
- Un solo SVG de chevron para toda la experiencia.
- Un solo sistema visual de botón circular.
- Hover/focus/active/disabled consistentes.
- Hero: controles dejan de cruzar horizontalmente el contenido a media altura;
  ahora forman un grupo estable en la esquina inferior derecha.
- Marcas: controles dejan de flotar lejos del carrusel y pasan a estar pegados
  a los extremos del rail.
- Marcas: flechas se desactivan correctamente al inicio/final.
- Rieles de productos: ahora tienen navegación explícita además del scroll.
- Product Detail: galería preparada con flechas coherentes, estados disabled y
  sincronización con miniaturas.
- Responsive: controles reducidos y reposicionados en móvil.
- prefers-reduced-motion continúa respetándose por las reglas globales existentes.

No se modifica:
- precios;
- inventario;
- selección/WhatsApp;
- Supabase;
- visibilidad/publicación;
- producción.

Aplicación:
1. Descomprimir en la raíz de lihen-platform.
2. Reemplazar/agregar los 7 archivos incluidos.
3. Ejecutar una sola ronda:
   pnpm --filter @lihen/storefront typecheck
   pnpm --filter @lihen/storefront build
   pnpm --filter @lihen/storefront dev
4. Verificación visual final:
   - hero;
   - marcas;
   - dos rieles de productos;
   - Product Detail con más de una imagen cuando haya un producto apto.
