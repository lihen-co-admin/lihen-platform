LIHEN QA-C — Product Detail / Richness Foundation
Fecha: 2026-08-25

Este patch NO inventa contenido comercial.

Incluye:
- estructura premium de Product Detail;
- galería deduplicada y limitada:
  Beauty Care: máximo 5 imágenes;
  Style: máximo 10 imágenes;
- indicador de imágenes WEB_DETAIL verificadas;
- descripción solo cuando existe en datos canónicos;
- detalles verificados: línea, SKU, categoría y subcategoría;
- estado explícito "Contenido en validación" cuando no existe descripción;
- beneficios, presentación y uso/cuidados quedan marcados como pendientes,
  en lugar de generar claims sin fuente verificada.

Estado actual verificado en DEV antes del patch:
- 952 Beauty Care visibles;
- 0/952 con descripción;
- 0/952 con WEB_DETAIL;
- los 23 EUGYM Style siguen ocultos y no se publican.

Aplicación:
1. Descomprimir en la raíz de lihen-platform.
2. Reemplazar los 2 archivos incluidos.
3. Ejecutar:
   pnpm --filter @lihen/storefront typecheck
   pnpm --filter @lihen/storefront build
4. Reiniciar Vite y abrir una ficha de producto.

No toca Supabase ni producción.
