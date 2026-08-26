LIHEN QA-C — Full-screen Product Detail
Fecha: 2026-08-25

Objetivo:
- Convertir la ficha de producto en una experiencia de pantalla completa.
- Mantener galería a la izquierda y contenido a la derecha en escritorio.
- Mantener layout vertical adaptativo en móvil/tablet.
- Mantener botón de cierre siempre visible.
- No cambia datos, lógica, Supabase ni publicación.

Aplicación:
1. Descomprimir en la raíz de lihen-platform.
2. Reemplazar apps/storefront/src/styles/products.css.
3. Ejecutar:
   pnpm --filter @lihen/storefront typecheck
   pnpm --filter @lihen/storefront build
4. Reiniciar Vite y abrir una ficha de producto.
