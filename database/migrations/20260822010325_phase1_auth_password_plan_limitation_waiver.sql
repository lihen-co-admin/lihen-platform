create table if not exists lihen_private.phase_exit_waivers (
  waiver_key text primary key check (btrim(waiver_key) <> ''),
  phase_code text not null check (btrim(phase_code) <> ''),
  control_key text not null check (btrim(control_key) <> ''),
  status text not null check (status in ('ACCEPTED','REVOKED')),
  reason text not null check (btrim(reason) <> ''),
  limitation_type text not null check (limitation_type in ('PLAN','PLATFORM','EXTERNAL_DEPENDENCY','OTHER')),
  evidence jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null,
  created_at timestamptz not null default now()
);

revoke all on table lihen_private.phase_exit_waivers from public, anon, authenticated;
grant select, insert on lihen_private.phase_exit_waivers to service_role;

insert into lihen_private.phase_exit_waivers (
  waiver_key,
  phase_code,
  control_key,
  status,
  reason,
  limitation_type,
  evidence,
  accepted_at
)
values (
  'PHASE1_1_25_LEAKED_PASSWORD_PROTECTION_PLAN_LIMITATION',
  '1.25',
  'auth_leaked_password_protection',
  'ACCEPTED',
  'Leaked-password protection remains disabled in Supabase Auth. The user explicitly authorized accepting this external plan/platform limitation for the Phase 1 exit gate. This waiver does not represent the control as enabled and must be revisited if the plan or capability changes.',
  'PLAN',
  jsonb_build_object(
    'advisor_status', 'Leaked Password Protection Disabled',
    'control_enabled', false,
    'password_complexity_hardened', true,
    'authorization_source', 'explicit_user_authorization_in_chat',
    'authorization_local_date', '2026-08-21',
    'remediation_url', 'https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection'
  ),
  now()
)
on conflict (waiver_key) do nothing;
