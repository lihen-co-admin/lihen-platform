LIHEN QA-C — Product Detail Full-Screen Editorial
Fecha: 2026-08-25

Objetivo:
Convertir la ficha en una experiencia editorial de pantalla completa y dejar una
base común para Beauty Care y Style sin inventar información comercial.

Incluye:
- pantalla completa real;
- galería protagonista;
- contador de imágenes + navegación con el sistema global de flechas;
- miniaturas más limpias;
- navegación de galería también con teclado ← / →;
- encabezado premium: marca, SKU, nombre, precio y estado;
- información confirmada separada de información todavía pendiente;
- lenguaje público limpio: se elimina "QA-C / Intelligence" de la interfaz;
- Beauty Care y Style comparten componente, pero los campos pendientes se adaptan:
  Beauty Care → beneficios, presentación, uso/cuidados;
  Style → material, talla/ajuste, colores/variantes, cuidados;
- CTA de selección + WhatsApp en dock sticky;
- agotados siguen sin poder agregarse;
- responsive preparado para desktop/tablet/móvil;
- Beauty Care máximo 5 imágenes; Style máximo 10.

No modifica:
- Supabase;
- inventario;
- precios;
- visibilidad;
- publicación;
- producción.

Aplicación:
1. Descomprimir en la raíz de lihen-platform.
2. Reemplazar los 2 archivos incluidos.
3. Ejecutar una sola ronda:
   pnpm --filter @lihen/storefront typecheck
   pnpm --filter @lihen/storefront build
   pnpm --filter @lihen/storefront dev
4. Abrir una ficha y validar visualmente.
