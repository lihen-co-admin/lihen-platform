LIHEN PLATFORM — FASE 2 SAFE NIGHTLY BATCH
Fecha: 2026-08-22

Contenido acumulativo:
- 2.4A Inventario operativo seguro.
- 2.5A Proveedores: lectura + create/update controlado.
- 2.5B Compras: lectura + creación de DRAFT con líneas.

Supabase DEV ya tiene aplicadas las migraciones de este batch.
No reejecutar manualmente SQL desde el dashboard. Mantener los archivos en database/migrations para trazabilidad del repo.

IMPORTANTE
- No se importó stock legacy nuevo.
- No se importaron los 8 proveedores legacy.
- No se importaron compras legacy.
- No se afectó caja.
- No se creó una compra real.
- Los dry-runs de proveedor/compra se ejecutaron dentro de transacción y ROLLBACK.

ENV local de Control Center (DEV):
VITE_INVENTORY_WRITE_MODE=controlled
VITE_SUPPLIER_WRITE_MODE=controlled
VITE_PURCHASE_WRITE_MODE=controlled

Mañana, después de copiar este paquete sobre la raíz del repositorio:
1) pnpm install --no-frozen-lockfile
2) pnpm check
3) git status
4) NO hacer commit antes de revisar el resultado.

Gate visual pendiente:
- /inventory
- /suppliers
- /purchases

No registrar datos ficticios para probar. Si no hay proveedor canónico real aprobado, la pantalla de compras puede quedar vacía y eso es correcto.
