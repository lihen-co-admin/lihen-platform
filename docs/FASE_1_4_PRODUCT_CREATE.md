# FASE 1.4 — PRODUCT CREATE / COMMAND SLICE

## Estado

IMPLEMENTADO EN MEMORIA / SUPABASE WRITE LOCKED.

## Flujo

```text
CreateProductPage
  -> CreateProductCommand
  -> CreateProductHandler
  -> ProductRepository
  -> InMemoryProductRepository.create()
```

## Gate de seguridad

FASE 1.2.1 todavía debe ejecutarse y aprobarse contra el Supabase DEV real antes de implementar cualquier `INSERT`, `UPDATE`, `UPSERT` o `DELETE` en `SupabaseProductRepository`.

En modo `VITE_PRODUCT_READ_SOURCE=supabase`:

1. `productsComposition.canCreate = false`;
2. la UI deshabilita la creación;
3. `SupabaseProductRepository.create()` lanza `ProductWriteBlockedError`.

Esta defensa doble evita habilitar escritura por accidente desde una modificación de UI.

## Reglas implementadas

- nombre requerido;
- precio finito y >= 0;
- estado canónico;
- SKU opcional;
- código de catálogo opcional;
- detección de SKU duplicado;
- detección de código de catálogo duplicado;
- ID generado mediante `IdGenerator`;
- persistencia a través del port `ProductRepository`;
- ninguna escritura Supabase.

## Deliberadamente fuera de alcance

Todavía no se crean:

- brand/category;
- inventario inicial;
- product_content;
- imágenes;
- audit log;
- outbox;
- RPC `create_product_atomic` nueva;
- escritura Supabase.

Estas capacidades se incorporarán después de aprobar el contrato real DEV y ampliar el Product Core por slices controlados.
