LIHEN PLATFORM — FASE 2.2 PRODUCT CREATE SLICE

1. Extraer este ZIP encima de la carpeta lihen-platform.
2. No reemplazar ni borrar .env.local.
3. En apps/control-center/.env.local confirmar/agregar:

   VITE_PRODUCT_READ_SOURCE=supabase
   VITE_AUTH_MODE=supabase
   VITE_PRODUCT_WRITE_MODE=controlled

   Mantener sus valores existentes de:
   VITE_SUPABASE_URL
   VITE_SUPABASE_PUBLISHABLE_KEY

4. Ejecutar:
   pnpm check
   pnpm --filter @lihen/control-center dev

5. Iniciar sesión con GitHub OWNER y comprobar:
   - Marcas carga datos reales.
   - Categorías carga datos reales.
   - Productos > Nuevo producto está habilitado.

NO crear un producto de prueba inventado. El primer CREATE persistente debe usar datos reales definidos por LIHEN.
