create schema if not exists lihen_private;

revoke all on schema lihen_private from public;
revoke all on schema lihen_private from anon;
revoke all on schema lihen_private from authenticated;
grant usage on schema lihen_private to supabase_auth_admin;

create table public.admin_roles (
  code text primary key,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint admin_roles_code_check check (code in ('OWNER','ADMIN','OPERATOR','VIEWER')),
  constraint admin_roles_name_not_blank check (length(btrim(name)) > 0)
);

insert into public.admin_roles (code, name, description, sort_order)
values
  ('OWNER', 'Owner', 'Máximo nivel de autorización de LIHEN Platform.', 10),
  ('ADMIN', 'Administrador', 'Administración operativa del Control Center.', 20),
  ('OPERATOR', 'Operador', 'Operación diaria con permisos limitados.', 30),
  ('VIEWER', 'Consulta', 'Acceso de solo lectura cuando esté aprobado.', 40);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role_code text not null default 'VIEWER' references public.admin_roles(code) on update restrict on delete restrict,
  authorization_status text not null default 'PENDING',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_authorization_status_check check (authorization_status in ('PENDING','ACTIVE','SUSPENDED')),
  constraint profiles_approval_consistency check (
    (authorization_status = 'ACTIVE' and approved_at is not null)
    or authorization_status <> 'ACTIVE'
  )
);

create index profiles_role_status_idx on public.profiles(role_code, authorization_status);
create index profiles_email_idx on public.profiles(email) where email is not null;

alter table public.admin_roles enable row level security;
alter table public.profiles enable row level security;

revoke all on table public.admin_roles from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.admin_roles to authenticated;
grant select on table public.profiles to authenticated;

create policy admin_roles_authenticated_read
  on public.admin_roles
  for select
  to authenticated
  using (true);

create policy profiles_read_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function lihen_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role_code, authorization_status)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), '')
    ),
    'VIEWER',
    'PENDING'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function lihen_private.handle_new_auth_user() from public;
revoke all on function lihen_private.handle_new_auth_user() from anon;
revoke all on function lihen_private.handle_new_auth_user() from authenticated;
grant execute on function lihen_private.handle_new_auth_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created_lihen_profile on auth.users;
create trigger on_auth_user_created_lihen_profile
  after insert on auth.users
  for each row execute function lihen_private.handle_new_auth_user();
