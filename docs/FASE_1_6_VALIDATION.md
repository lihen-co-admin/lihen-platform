# Validación — FASE 1.6

## Checks estáticos ejecutados

- `UpdateProductCommand` no contiene `salePrice`.
- `SupabaseProductRepository` no contiene `.insert(`, `.update(`, `.upsert(` ni `.delete(`.
- Existe una ruta separada `/products/:id/price`.
- El historial contiene reason, actorId y changedAt.
- `ProductsPage`/páginas siguen sin importar Supabase directamente.

## Tests añadidos

- cambia precio y crea historial;
- conserva actor, motivo y timestamp;
- conserva múltiples entradas históricas;
- rechaza producto inexistente;
- rechaza precio igual al actual;
- exige motivo;
- Supabase bloquea `changeSalePrice`.

## Limitación del entorno

El entorno de construcción actual no dispone de las dependencias npm/workspace instaladas. Por ello no se declara como ejecutado `pnpm check`, Vitest, Vite ni Playwright. El proyecto conserva Node 24 LTS como baseline definida.
