# FASE 1.1 — Product Core / Read Slice

Primer flujo vertical funcional de LIHEN Platform.

```text
ProductsPage
  ↓
GetProductsQuery
  ↓
GetProductsHandler
  ↓
ProductRepository
  ↓
InMemoryProductRepository
```

## Objetivo

Validar los boundaries de Domain/Application/Port/Adapter/UI antes de conectar Supabase DEV.

## Decisiones

- La UI no recibe entidades `Product` directamente; recibe `ProductListItemDTO`.
- `ProductsPage` no conoce Supabase ni detalles de persistencia.
- El adapter actual usa fixtures de desarrollo y se reemplazará en FASE 1.2.
- Ningún producto real fue copiado al nuevo repositorio.
- No se escribe ni se consulta producción.

## Siguiente reemplazo

```text
InMemoryProductRepository
        ↓
SupabaseProductRepository (DEV)
```

El contrato `ProductRepository` y el handler no deberían cambiar por ese reemplazo.
