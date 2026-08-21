# FASE 1.4 — VALIDATION

## Gate funcional esperado

- CreateProductCommand valida payload.
- CreateProductHandler comprueba duplicados.
- InMemoryProductRepository persiste durante la sesión.
- ProductsPage no accede a persistencia directamente.
- CreateProductPage no importa Supabase.
- SupabaseProductRepository sigue sin ejecutar escrituras.
- modo Supabase bloquea creación.

## DEV real

No aprobado todavía. La habilitación de escrituras permanece condicionada a completar `FASE 1.2.1 — DEV SCHEMA + RLS PRECHECK` contra el proyecto Supabase DEV real.
