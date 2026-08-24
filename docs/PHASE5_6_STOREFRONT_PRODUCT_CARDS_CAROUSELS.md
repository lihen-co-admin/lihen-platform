# FASE 5.6 — Product cards + carruseles canónicos

## Estado de implementación
IMPLEMENTED — pendiente únicamente del gate integral acordado antes de FASE 5.12.

## Alcance
- Product card reusable con imagen, marca, nombre, precio y disponibilidad abstracta.
- Dos rails Home hidratados desde `get_storefront_products_controlled`.
- Lectura exclusiva por RPC público controlado; no `products.js`, CSV ni stock exacto.
- Imágenes lazy/async salvo primeras tarjetas prioritarias.
- Detalle desacoplado de la tarjeta.
