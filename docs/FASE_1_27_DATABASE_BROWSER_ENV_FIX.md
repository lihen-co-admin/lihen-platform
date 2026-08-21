# FASE 1.27 — Database browser environment decoupling fix

## Hallazgo

`packages/database/src/browser-supabase.ts` usaba `import.meta.env` como valor por defecto.
Ese objeto es específico del bundler Vite y el paquete `@lihen/database` se compila como paquete TypeScript reutilizable, por lo que TypeScript no debe asumir tipos de Vite dentro de la capa de datos.

## Corrección

- `getBrowserSupabaseClient` ahora exige recibir explícitamente `env: Record<string, unknown>`.
- `apps/control-center/src/auth/AuthProvider.tsx` pasa `import.meta.env` desde la capa de aplicación/browser.
- `createProductsComposition` ya seguía ese patrón y no requirió cambio.

## Resultado arquitectónico

La capa `database` deja de depender implícitamente de Vite y mantiene el contrato:

`UI / APP (Vite env) -> DATABASE (env explícito) -> Supabase`

No se agregaron tipos de Vite ni dependencias innecesarias a `@lihen/database`.
