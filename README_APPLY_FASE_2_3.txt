LIHEN PLATFORM — FASE 2.3 PRODUCT UPDATE / DEV

Este paquete se aplica ENCIMA del repositorio ya actualizado con CORE 02→15.

1. Copiar/mezclar los archivos conservando rutas.
2. No reemplazar archivos .env reales ni secretos.
3. La migración ya fue aplicada al Supabase DEV conectado:
   20260822045500_phase2_3_enable_controlled_product_update_dev.sql
4. En el .env local autorizado de Control Center agregar/cambiar:
   VITE_PRODUCT_UPDATE_WRITE_MODE=controlled
5. Ejecutar:
   pnpm install --no-frozen-lockfile
   pnpm check
6. Ejecutar Control Center y validar el gate descrito en:
   docs/phase-2/FASE_2_3_PRODUCT_UPDATE_SUPABASE_DEV.md

IMPORTANTE
- No modificar precio desde Editar producto.
- No modificar stock desde Editar producto.
- No publicar PDF/Web desde Editar producto.
- No inventar datos para validar.
