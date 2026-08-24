# FASE 6.1 — Storefront release environment contract

Estado: IMPLEMENTED — pendiente de gate de release posterior a FASE 5.12.

- El fallback DEV de Supabase solo funciona con `import.meta.env.DEV`.
- Una build ejecutada como release requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `tooling/validate-storefront-release-env.mjs` rechaza variables ausentes, URL no HTTPS y claves con apariencia de service-role.
- `.env.production.example` documenta el contrato sin contener secretos.
