LIHEN QA-03 — Cosmetic WhatsApp Fix
Fecha: 2026-08-25

Cambio:
- Elimina el emoji inicial del saludo de WhatsApp.
- Evita el carácter de reemplazo visible en WhatsApp Web.
- No cambia productos, cantidades, totales ni lógica del enlace.
- No toca Supabase ni producción.

Aplicación:
1. Descomprimir en la raíz de lihen-platform.
2. Reemplazar apps/storefront/src/components/whatsapp.ts.
3. Ejecutar:
   pnpm --filter @lihen/storefront typecheck
   pnpm --filter @lihen/storefront build
