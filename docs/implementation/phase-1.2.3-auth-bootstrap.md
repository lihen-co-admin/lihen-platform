# FASE 1.2.3 — First DEV Auth account + JWT read probe

## Purpose

Create the first LIHEN Platform DEV Auth account through the supported Supabase Auth `signUp()` flow, then authenticate with `signInWithPassword()` and prove `GetProducts` crosses RLS with a real JWT.

## Security constraints

- No direct writes to `auth.users`.
- No `service_role` in the browser.
- No authorization based on `user_metadata`.
- Bootstrap signup is off by default.
- `products`, `brands`, and `categories` remain SELECT-only for `authenticated`.

## One-time bootstrap flow

1. Copy `apps/control-center/.env.dev.example` to the local env file used by Vite.
2. Set `VITE_DEV_ALLOW_BOOTSTRAP_SIGNUP=true`.
3. Run Control Center against DEV and open `/bootstrap-admin`.
4. Enter the administrator's own email and a private password (minimum 12 characters).
5. If Supabase requires email confirmation, confirm the message before login.
6. Return `VITE_DEV_ALLOW_BOOTSTRAP_SIGNUP=false` and restart/rebuild.
7. Sign in at `/login`.
8. Open `/products`.

Expected first probe: the request succeeds with an authenticated JWT and returns an empty list because DEV currently contains zero product rows. An empty list is PASS; 401/403 is FAIL.

## Gate closure evidence

- `auth.users >= 1`.
- Auth logs show a successful password authentication.
- Browser session contains a valid Supabase session.
- `GetProducts` returns without RLS/API error.
- No write policy exists for the Product Core.
