# FASE 1.11 — Product Update Controlled Write Foundation

## Objetivo

Preparar `UpdateProduct` contra Supabase DEV sin habilitar la escritura todavía.

## Contrato de seguridad

1. `VITE_PRODUCT_UPDATE_WRITE_MODE=blocked` por defecto.
2. `SupabaseProductRepository.update()` solo usa `rpc('update_product_controlled')` cuando el flag está explícitamente en `controlled`.
3. `public.update_product_controlled(...)` valida `auth.uid()` y exige `profiles.authorization_status='ACTIVE'` con rol `OWNER` o `ADMIN`.
4. La RPC está creada como `SECURITY DEFINER` con `search_path=''` y referencias con esquema explícito.
5. `PUBLIC`, `anon` y `authenticated` no tienen `EXECUTE` durante esta fase.
6. `authenticated` conserva únicamente `SELECT` directo sobre `public.products`; no recibe `UPDATE` directo.
7. El precio de venta no forma parte de UpdateProduct y se preserva. Pricing seguirá exclusivamente en `ChangeProductSalePrice`.
8. `operation_key` usa `lihen_private.product_write_operations` con tipo `UPDATE_PRODUCT`, fingerprint del request y snapshot del resultado para repetición idempotente.
9. `brand_id` y `category_id` son preservados por el read adapter de Supabase para evitar borrado accidental durante un futuro update.

## Cutover pendiente

`database/migrations/pending/006_enable_controlled_product_update.sql` NO debe aplicarse hasta:

- login GitHub/JWT real aprobado;
- perfil real creado;
- promoción explícita `OWNER` o `ADMIN` + `ACTIVE`;
- probe de autorización aprobado;
- lectura segura de taxonomía disponible en UI para no presentar selectores canónicos vacíos;
- aprobación explícita para habilitar UpdateProduct en DEV.

Production permanece fuera de alcance.
