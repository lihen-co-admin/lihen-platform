# FASE 1.10 — Controlled Product Write Foundation

## Estado

Preparado en DEV, **apagado**.

## Defensa en profundidad

1. `VITE_PRODUCT_WRITE_MODE=blocked` por defecto.
2. `SupabaseProductRepository.create()` solo llama RPC en modo `controlled`.
3. `public.create_product_controlled(...)` existe, pero `authenticated` NO tiene `EXECUTE`.
4. `products` no concede `INSERT/UPDATE/DELETE` a `authenticated`.
5. La RPC valida `auth.uid()` contra `profiles` y solo acepta `OWNER|ADMIN + ACTIVE`.
6. La RPC usa `operation_key` idempotente y ejecuta producto + operación en una sola transacción Postgres.

## Cutover pendiente

No aplicar `database/migrations/pending/005_enable_controlled_product_create.sql` hasta que:

- GitHub JWT probe real pase.
- exista un perfil real `OWNER|ADMIN + ACTIVE`.
- los probes de autorización de esta fase pasen.
- exista aprobación explícita para habilitar CreateProduct en DEV.

## Fuera de alcance

- UpdateProduct Supabase.
- ChangeSalePrice Supabase.
- Product Images writes.
- writes en producción.

## Migración DEV

`20260821063737_controlled_product_create_foundation`
