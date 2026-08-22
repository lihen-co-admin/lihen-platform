LIHEN — FASE 2 SAFE CONTINUATION
Incluye acumulativamente 2.4A → 2.8A.

MAÑANA:
1. Copiar este ZIP sobre la raíz de lihen-platform.
2. En apps/control-center/.env.development.local conservar los valores Supabase existentes y agregar:
   VITE_INVENTORY_WRITE_MODE=controlled
   VITE_SUPPLIER_WRITE_MODE=controlled
   VITE_PURCHASE_WRITE_MODE=controlled
   VITE_ORDER_WRITE_MODE=controlled
   VITE_SALE_WRITE_MODE=controlled
   VITE_FINANCE_WRITE_MODE=controlled
3. Ejecutar:
   pnpm install --no-frozen-lockfile
   pnpm check
   git status
4. NO usar todavía Ventas/POS ni Caja con datos reales hasta completar el gate visual.
5. Revisar /inventory /suppliers /purchases /orders /sales /finance.

Supabase DEV ya tiene las migraciones aplicadas. Los dry-runs se hicieron con ROLLBACK y no dejaron ventas, cuentas, pedidos ni dinero de prueba.
