# FASE 2.5A — Proveedores controlados

- `suppliers` sigue siendo la identidad canónica; no se importan automáticamente los 8 proveedores legacy.
- OWNER/ADMIN ACTIVE puede crear/editar mediante RPC idempotente.
- INSERT/UPDATE/DELETE directos permanecen cerrados para authenticated.
- Crear/editar proveedor no toca productos, inventario, compras ni caja.
- La reconciliación de proveedores legacy queda para Fase 3.
