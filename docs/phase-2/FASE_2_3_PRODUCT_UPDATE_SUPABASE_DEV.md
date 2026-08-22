# FASE 2.3 — Product Update Slice / Supabase DEV

## Objetivo

Habilitar la edición controlada de la **identidad canónica** de un producto desde LIHEN Control Center sin abrir `UPDATE` directo sobre `public.products`.

## Qué puede cambiar este slice

- `sku`;
- `catalog_code`;
- `slug` derivado por el dominio;
- `name`;
- `brand_id`;
- `category_id`;
- `status`.

`business_line` permanece visible pero bloqueada en la UI de edición para evitar una reclasificación accidental entre `BEAUTY_CARE` y `STYLE`.

## Qué NO cambia aquí

- precio de venta;
- stock o movimientos de inventario;
- imágenes;
- publicación en PDF;
- publicación en storefront/web;
- costos/proveedor;
- caja, ventas o pedidos.

Cada dato pertenece a su propio módulo/comando y debe conservar su trazabilidad independiente.

## Contrato live

Entrada permitida:

`public.update_product_controlled(...)`

La función existente exige:

- JWT autenticado (`auth.uid()`);
- perfil `authorization_status = ACTIVE`;
- rol `OWNER` o `ADMIN`;
- `operation_key` no vacío e idempotente;
- producto existente;
- nombre/slug/estado válidos;
- brand existente cuando se suministra;
- category alineada con `business_line`.

## Seguridad

Después del cutover DEV:

- `authenticated` tiene `EXECUTE` sobre `update_product_controlled`;
- `anon` no tiene `EXECUTE`;
- `authenticated` continúa sin `INSERT/UPDATE/DELETE` directo en `public.products`;
- el precio sigue separado mediante `change_product_sale_price_controlled`;
- la publicación PDF/Web no forma parte de Product Master update.

## Dry-run live

Se ejecutó una actualización idempotente sobre un producto real usando el contexto del OWNER/ACTIVE dentro de una transacción y se hizo `ROLLBACK`.

Verificación posterior:

- RPC accesible por `authenticated`: **sí**;
- `UPDATE` directo de `authenticated` sobre `products`: **no**;
- residuo de `product_write_operations` del dry-run: **no**.

## Configuración de Control Center

Una vez aplicada la migración DEV, el entorno local autorizado debe usar:

```env
VITE_PRODUCT_UPDATE_WRITE_MODE=controlled
```

No se incluyen ni modifican secretos en este paquete.

## Gate de navegador

Para cerrar FASE 2.3 completamente:

1. login con perfil OWNER/ACTIVE;
2. abrir un producto real;
3. confirmar que `Editar producto` está habilitado;
4. modificar únicamente un dato real solicitado por la usuaria;
5. guardar;
6. confirmar que el detalle/listado refleja el cambio;
7. confirmar que precio, stock, imágenes y publicación no cambiaron.

No se crean datos de prueba persistentes para satisfacer este gate.
