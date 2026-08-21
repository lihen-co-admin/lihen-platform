# FASE 1.2.3 — Final Auth + RLS Probe

## Estado actual

La implementación está lista, pero el gate no puede cerrarse mientras `auth.users = 0`.

## Ruta de diagnóstico

`/dev-auth-probe`

La ruta está protegida por `ProtectedRoute` y solo puede abrirse después de una sesión real de Supabase Auth.

Al ejecutar el probe:

1. exige una `Session` real con `access_token`;
2. confirma que Products usa `SupabaseProductRepository`;
3. genera una huella SHA-256 parcial del JWT sin mostrar el token;
4. ejecuta `GetProducts` por el slice real;
5. considera PASS únicamente si la consulta atraviesa Data API/RLS sin error.

En el baseline actual, `products` tiene 0 filas. Por tanto, el resultado esperado inicial es `Productos leídos: 0`, no datos ficticios.

## Gate

Para cerrar FASE 1.2.1 / 1.2.3 deben cumplirse simultáneamente:

- `auth.users >= 1`;
- cuenta confirmada cuando el proveedor de email lo requiera;
- login mediante `signInWithPassword()`;
- sesión con access token real;
- `/dev-auth-probe` = PASS;
- `GetProducts` devuelve `[]` o filas reales sin 401/403;
- RLS sigue sin permitir `anon`;
- no se habilitan INSERT/UPDATE/DELETE todavía.

## Seguridad

La página nunca renderiza el JWT. Solo muestra una huella SHA-256 truncada que sirve como evidencia de que una sesión distinta produjo un token.
