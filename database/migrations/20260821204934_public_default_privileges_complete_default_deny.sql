alter default privileges for role postgres in schema public revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all privileges on functions from public, anon, authenticated, service_role;
