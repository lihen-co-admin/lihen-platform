-- FASE 1.2.3 — Auth user gate (READ ONLY)
-- Ejecutar únicamente en lihen-platform-dev.
select
  count(*)::int as auth_users,
  count(*) filter (where email_confirmed_at is not null)::int as confirmed_users
from auth.users;
