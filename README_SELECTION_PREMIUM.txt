LIHEN — Premium Selection Visual Patch
Fecha: 2026-08-25

Motivo:
El estado seleccionado funcionaba, pero visualmente el botón de check y los
controles de cantidad competían entre sí. Además, la regla display:grid podía
anular visualmente el atributo HTML hidden.

Cambios:
- La tarjeta completa comunica que está seleccionada mediante borde, fondo y sombra sutil.
- Se elimina visualmente la competencia entre check y cantidad.
- El botón + desaparece de forma explícita cuando el producto está seleccionado.
- La cantidad queda en una única cápsula limpia: −  2  +.
- El estado de toda la tarjeta se sincroniza con Mi selección.
- Los controles del drawer usan el mismo lenguaje visual.
- Se conserva la ficha Product Detail full-screen.
- No cambia precios, inventario, WhatsApp, Supabase ni producción.

Aplicación:
1. Descomprimir en la raíz de lihen-platform.
2. Reemplazar los 3 archivos incluidos.
3. Ejecutar:
   pnpm --filter @lihen/storefront typecheck
   pnpm --filter @lihen/storefront build
4. Reiniciar Vite.
5. Seleccionar 2 o 3 productos y revisar cards + Mi selección.
