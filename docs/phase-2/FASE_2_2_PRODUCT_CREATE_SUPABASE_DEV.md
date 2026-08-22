# FASE 2.2 — Product Create Slice / Supabase DEV

## Objetivo

Habilitar creación manual de productos desde LIHEN Control Center sin abrir INSERT/UPDATE/DELETE directos sobre `public.products`.

## Contrato live

Entrada permitida: `public.create_product_controlled(...)`.

La función exige:
- JWT autenticado (`auth.uid()`);
- perfil `authorization_status = ACTIVE`;
- rol `OWNER` o `ADMIN`;
- `operation_key` no vacío e idempotente;
- nombre/slug/precio/estado válidos;
- brand existente cuando se suministra;
- category alineada con `business_line` cuando se suministra.

## Restricciones preservadas

- `authenticated` NO tiene INSERT/UPDATE/DELETE directo sobre `public.products`.
- `update_product_controlled` sigue revocado.
- `change_product_sale_price_controlled` sigue revocado.
- crear producto no publica automáticamente en storefront.
- crear producto no inventa stock, imágenes, brand ni category.
- el formulario inicia nuevos productos como `INACTIVE`.

## Taxonomía

FASE 2.2 incorpora lectura de `brands` y `categories` mediante RLS en Supabase DEV para que el formulario use IDs canónicos reales.

## Security Advisor

Al habilitar `EXECUTE` para authenticated, Supabase Security Advisor reporta intencionalmente `authenticated_security_definer_function_executable` porque el RPC es SECURITY DEFINER. La exposición es deliberada y acotada: la función realiza autorización ACTIVE + OWNER/ADMIN internamente y las escrituras directas permanecen revocadas. No equivale a acceso general de escritura.

## Validación server-side

Se ejecutó un dry-run transaccional bajo el OWNER real, creando un producto de prueba dentro de SAVEPOINT y haciendo ROLLBACK. Verificación posterior:
- producto de probe persistido: NO;
- `product_write_operations` del probe persistida: NO.

## Gate de cierre

Para cerrar FASE 2.2 falta validar desde navegador:
1. `VITE_PRODUCT_WRITE_MODE=controlled`;
2. login OWNER/ACTIVE;
3. marcas y categorías cargan desde Supabase;
4. formulario Nuevo producto queda habilitado;
5. creación real únicamente con datos elegidos por la usuaria (no datos inventados por tooling);
6. producto creado aparece en detalle/listado y no queda publicado automáticamente.
