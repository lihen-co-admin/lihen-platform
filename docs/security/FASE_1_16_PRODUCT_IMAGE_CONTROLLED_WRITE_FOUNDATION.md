# FASE 1.16 — Product Image Controlled Write Foundation

## Objetivo

Preparar persistencia transaccional e idempotente para `AddProductImage` y
`SetMainProductImage`, sin habilitar todavía ningún write desde el navegador y
sin configurar Supabase Storage.

## RPCs

- `public.add_product_image_controlled(...)`
- `public.set_main_product_image_controlled(...)`

Ambas son `SECURITY DEFINER`, fijan `search_path = ''`, verifican `auth.uid()` y
exigen un perfil LIHEN `OWNER/ADMIN + ACTIVE`.

En FASE 1.16 se revoca `EXECUTE` a `PUBLIC`, `anon` y `authenticated`.

## Idempotencia

`lihen_private.product_image_write_operations` registra `operation_key`,
`operation_type`, actor, producto, imagen, fingerprint, snapshot y timestamp.

Una `operation_key` repetida solo devuelve el resultado original cuando actor,
operación y payload coinciden. En otro caso se rechaza con
`LIHEN_PRODUCT_IMAGE_WRITE_OPERATION_CONFLICT`.

## Concurrencia y rollback

Cada mutación bloquea la fila del producto con `FOR UPDATE`, serializando cambios
de imágenes del mismo producto.

`SetMainProductImage` desmarca la principal anterior y marca la nueva dentro de
la misma transacción. Si cualquier paso falla, PostgreSQL revierte todo.

## Invariante de imagen principal

Se conserva el índice parcial de FASE 1.14: máximo una imagen
`ACTIVE + is_main=true` por producto.

## Storage

Fuera de alcance: no bucket, upload, delete ni políticas de `storage.objects`.
`AddProductImage` solo prepara metadata basada en `public_url`, dejando
`storage_bucket/storage_path = NULL`.

## Gates

Frontend: `VITE_PRODUCT_IMAGE_WRITE_MODE=blocked` por defecto.

Base de datos: ambas RPC no tienen `EXECUTE` para `authenticated`.

## Cutover pendiente

`database/migrations/pending/008_product_images_storage_and_write_cutover.sql`
contiene únicamente los grants futuros de metadata. Storage continúa pendiente.
