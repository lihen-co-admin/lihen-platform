LIHEN PLATFORM — FASE 2 SAFE CONTINUATION

Este paquete es ACUMULATIVO y reemplaza el ZIP nocturno anterior.
Incluye:
- 2.4A Inventario operativo seguro
- 2.5A Proveedores controlados
- 2.5B Compras DRAFT
- 2.5C Confirmación/recepción de compras + costo histórico
- 2.6A Pedidos DRAFT
- 2.6B Confirmación/cancelación de pedidos + reserva de inventario

No incluye todavía:
- Ventas/POS que descuenten ON_HAND
- Caja/finanzas operativas
- Pagos a proveedor
- Migración de saldos/productos/pedidos/caja legacy

Mañana:
1. Copiar este ZIP sobre la raíz de lihen-platform.
2. En apps/control-center/.env.development.local mantener las variables existentes y agregar:
   VITE_INVENTORY_WRITE_MODE=controlled
   VITE_SUPPLIER_WRITE_MODE=controlled
   VITE_PURCHASE_WRITE_MODE=controlled
   VITE_ORDER_WRITE_MODE=controlled
3. Ejecutar:
   pnpm install --no-frozen-lockfile
   pnpm check
   git status
4. NO hacer commit hasta revisar el gate visual.
5. Revisar rutas:
   /inventory
   /suppliers
   /purchases
   /orders

Supabase DEV ya tiene las migraciones aplicadas. Copiar las migraciones al repo mantiene trazabilidad; no volver a ejecutarlas manualmente contra DEV.
