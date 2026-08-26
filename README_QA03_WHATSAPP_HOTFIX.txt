LIHEN QA-03 — WhatsApp Hotfix
Fecha: 2026-08-25

Usa el número oficial LIHEN +57 305 738 4163 con enlaces wa.me directos.
Esto permite mantener el mensaje dinámico prellenado mediante ?text= para
Mi selección y Product Detail, y deja consistentes los enlaces del footer
y contenido institucional.

Aplicación desde la raíz de lihen-platform:
1. Descomprimir este ZIP en la raíz.
2. Aceptar reemplazo de los 3 archivos incluidos.
3. Ejecutar:
   pnpm --filter @lihen/storefront typecheck
   pnpm --filter @lihen/storefront build
4. Si Vite sigue abierto, detenerlo y volver a ejecutar:
   pnpm --filter @lihen/storefront dev
5. Probar dos productos con cantidades distintas y abrir WhatsApp.

No toca Supabase ni producción.
