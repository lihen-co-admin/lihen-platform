# FASE 1.5 — Product Update / Command Slice

## Estado

Implementado para `InMemoryProductRepository`. Escrituras Supabase continúan bloqueadas hasta aprobar FASE 1.2.1 contra DEV real.

## Flujo

`UpdateProductPage -> UpdateProductCommand -> UpdateProductHandler -> ProductRepository.update -> InMemoryProductRepository`

## Campos editables en este slice

- nombre
- SKU opcional
- código de catálogo opcional
- estado
- precio actual de venta

## Reglas

- El producto debe existir.
- SKU y código de catálogo se comparan sin distinguir mayúsculas/minúsculas en el adapter en memoria.
- Se permite conservar el SKU/código del propio producto.
- Se rechaza utilizar SKU/código perteneciente a otro producto.
- SKU y código pueden limpiarse.
- Precio debe ser finito y >= 0.
- SupabaseProductRepository.update() lanza `PRODUCT_WRITE_BLOCKED` y no contiene UPDATE SQL/PostgREST.

## Precio

FASE 1.5 permite modificar `salePrice` únicamente para completar el slice en memoria solicitado. No crea historial, auditoría ni outbox. Antes de habilitar escritura real, FASE 1.6 deberá convertir el cambio de precio en una operación especializada (`ChangeProductSalePrice`) con historial e invariantes atómicas.

## Gate Supabase

No se habilita `UPDATE` mientras FASE 1.2.1 no tenga evidencia real de DEV para schema, RLS, policies y lectura autenticada.
