LIHEN — Availability Selection Guard
Fecha: 2026-08-25

Hallazgo visual:
En la validación apareció al menos un producto marcado "Agotado" que seguía
permitiendo cantidad y selección. Eso es una inconsistencia comercial.

Corrección:
- AVAILABLE y LOW_STOCK: sí se pueden agregar a Mi selección.
- OUT_OF_STOCK: muestra "No disponible" y no puede seleccionarse.
- COMING_SOON: muestra "Próximamente" y no puede seleccionarse.
- La ficha full-screen mantiene WhatsApp para consultar, pero deshabilita
  "Agregar a mi selección" cuando no hay disponibilidad.
- Limpia selecciones antiguas de productos no disponibles cuando reaparecen
  en un conjunto renderizado.
- No altera inventario, precios, Supabase ni producción.

Aplicación:
1. Descomprimir en la raíz de lihen-platform.
2. Reemplazar los 5 archivos incluidos.
3. Ejecutar:
   pnpm --filter @lihen/storefront typecheck
   pnpm --filter @lihen/storefront build
4. Reiniciar Vite.
5. Confirmar que una card "Agotado" ya no tenga control − / cantidad / +.
