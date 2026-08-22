# FASE 2.1 — Control Center Auth + Administrative Profile + RLS Gate

Status: IMPLEMENTED IN CODE / LIVE USER PROBE PENDING

## Goal

The Control Center must not treat the presence of a Supabase JWT as sufficient administrative authorization.

The gate requires all of the following:

1. Supabase Auth session exists.
2. The authenticated user can read only their own `profiles` row through RLS.
3. `profiles.authorization_status = ACTIVE`.
4. `profiles.role_code` exists in `public.admin_roles`.
5. Product reads execute through the Supabase repository under the authenticated browser session.
6. The access token is never displayed; only a short SHA-256 fingerprint may be shown for evidence.

## DEV evidence observed before code change

- Auth identity exists through GitHub provider.
- Profile is `OWNER / ACTIVE`.
- `profiles_read_own` restricts profile reads to `auth.uid()`.
- `products_authenticated_read` allows product read to authenticated users, therefore product read alone was not a sufficient admin authorization probe.

## Implementation

- Added a pure administrative authorization decision function.
- AuthProvider now loads the current user's profile and known role codes.
- ProtectedRoute requires an authorized ACTIVE profile, not just a JWT.
- DevAuthProbe reports profile status and role in addition to JWT fingerprint and product count.
- Added unit tests for authorization decisions.

## Exit gate

Phase 2.1 becomes PASS/CLOSED only after an actual browser OAuth/login session executes the probe and confirms:

- profile `ACTIVE`
- recognized role
- Supabase product source
- product count expected for DEV
- no token disclosure
