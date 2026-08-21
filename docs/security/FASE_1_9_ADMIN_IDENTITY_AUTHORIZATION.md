# FASE 1.9 — Admin Identity & Authorization Foundation

## Security model

Authentication and authorization are intentionally separated.

- `auth.users`: Supabase/GitHub identity.
- `public.profiles`: LIHEN authorization profile.
- `public.admin_roles`: controlled role catalog.
- Every new Auth identity gets `VIEWER + PENDING`.
- No user becomes ADMIN/OWNER automatically.
- `authenticated` can read only its own profile.
- No client-side profile write grants exist.
- Product writes remain blocked.

## Roles

- OWNER: future authorization administration authority.
- ADMIN: future administrative operations.
- OPERATOR: future limited operational writes.
- VIEWER: approved read-only access.

Role alone is insufficient. The profile must also be `ACTIVE`.

## Authorization states

- PENDING: authenticated but not approved.
- ACTIVE: approved for the capabilities later mapped to the role.
- SUSPENDED: authenticated identity exists but administrative authorization is disabled.

## First GitHub account

After the first OAuth login, the trigger creates a profile as `VIEWER + PENDING`.
The first OWNER promotion must be an explicit controlled action after the real JWT/RLS probe is closed. This phase does not auto-promote the first account.

## Product-write gate

FASE 1.9 does not create INSERT, UPDATE or DELETE policies for `products`.
