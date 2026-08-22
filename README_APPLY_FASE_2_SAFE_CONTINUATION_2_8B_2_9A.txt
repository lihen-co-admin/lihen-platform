LIHEN PLATFORM — FASE 2 SAFE CONTINUATION
Incluye de forma acumulativa 2.4A → 2.9A.

IMPORTANTE
- Usar este ZIP en lugar de los ZIP acumulativos anteriores.
- No importa inventario/caja/proveedores/pedidos legacy.
- Supabase DEV ya tiene las migraciones aplicadas; los archivos se incluyen para sincronizar el repositorio.

.env.development.local
VITE_INVENTORY_WRITE_MODE=controlled
VITE_SUPPLIER_WRITE_MODE=controlled
VITE_PURCHASE_WRITE_MODE=controlled
VITE_ORDER_WRITE_MODE=controlled
VITE_SALE_WRITE_MODE=controlled
VITE_FINANCE_WRITE_MODE=controlled

Gate al volver al computador:
pnpm install --no-frozen-lockfile
pnpm check
git status

No hacer commit antes de revisar el gate y las pantallas.
