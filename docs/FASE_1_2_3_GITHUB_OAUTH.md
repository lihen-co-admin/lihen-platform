# FASE 1.2.3 — GitHub OAuth DEV

## Objetivo
Cerrar el circuito real de autenticación del Control Center usando GitHub como proveedor OAuth de Supabase Auth.

## Flujo

`/login` → `signInWithOAuth({ provider: "github" })` → GitHub → Supabase callback → sesión/JWT → `/dev-auth-probe` → `GetProducts` → RLS → `public.products`.

## Configuración externa DEV

- Supabase project: `lihen-platform-dev`
- Supabase callback registrado en GitHub: `https://vnmkupzptujtywnnabkp.supabase.co/auth/v1/callback`
- Site URL DEV: `http://localhost:5173`
- Redirect allow-list DEV: `http://localhost:5173/**`

## Seguridad

- El navegador usa únicamente publishable key.
- No se utiliza service role.
- El Client Secret de GitHub vive únicamente en la configuración del proveedor de Supabase.
- El token JWT no se imprime en `/dev-auth-probe`; solo se utiliza una huella para diagnóstico.
- GitHub autentica identidad; no concede por sí solo rol administrador. La autorización formal se resolverá en una fase posterior.

## Gate

El gate queda PASS solo cuando exista una sesión Auth real y `/dev-auth-probe` confirme que `GetProducts` puede leer a través de RLS como `authenticated`.
