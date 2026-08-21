# FASE 1.27 — Node tooling ESLint environment fix

## Hallazgo confirmado en validación Windows

El `typecheck` completo de los 8 workspaces pasó. El siguiente bloqueo apareció en `eslint .` y quedó aislado en `tooling/cutover-web-images-v1.mjs`.

ESLint trataba el script `.mjs` como JavaScript genérico y, por tanto, marcaba como `no-undef` globales válidos del runtime Node 24 (`process`, `Buffer`, `console`) y APIs web disponibles globalmente en Node 24 (`fetch`, `Headers`). También detectó un bloque `catch {}` vacío usado únicamente para escritura best-effort del reporte de fallo.

## Corrección

- `eslint.config.js` incorpora una configuración acotada a `tooling/**/*.mjs` con los globales de runtime usados por estos scripts declarados como `readonly`.
- `tooling/cutover-web-images-v1.mjs` conserva el comportamiento best-effort del reporte de fallo, pero el `catch` ahora contiene un comentario explícito para no infringir `no-empty`.
- No se deshabilitó globalmente `no-undef` ni `no-empty`.
- No se modificó la lógica de cutover, hashes, Storage, Supabase, concurrencia, idempotencia ni finalización de metadata.

## Gate

La validación autoritativa continúa siendo Windows + Node 24 + pnpm 10.15.0 mediante:

```powershell
pnpm install --frozen-lockfile
pnpm check
```
