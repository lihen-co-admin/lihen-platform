import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('WAVE 12 / GAP-040 RLS & Permission Matrix VNext architecture', () => {
  const matrix = read(
    'packages/database/src/security/rls-permission-matrix-vnext.ts',
  );
  const env = read('packages/database/src/env.ts');
  const supabaseClient = read('packages/database/src/supabase-client.ts');
  const permissionModel = read(
    'packages/intelligence-core/src/permission-model.ts',
  );
  const controlPlane = read(
    'packages/intelligence-core/src/control-plane.ts',
  );
  const defaultDeny1 = read(
    'database/migrations/20260821204652_public_default_privileges_security_hardening.sql',
  );
  const defaultDeny2 = read(
    'database/migrations/20260821204934_public_default_privileges_complete_default_deny.sql',
  );

  it('keeps database default privileges in default-deny posture', () => {
    expect(defaultDeny1).toMatch(
      /revoke select, insert, update, delete on tables from anon, authenticated, service_role/i,
    );
    expect(defaultDeny2).toMatch(
      /revoke all privileges on tables from public, anon, authenticated, service_role/i,
    );
    expect(defaultDeny2).toMatch(
      /revoke all privileges on functions from public, anon, authenticated, service_role/i,
    );
  });

  it('keeps browser configuration on publishable key only', () => {
    expect(env).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
    expect(supabaseClient).toContain(
      'parsed.VITE_SUPABASE_PUBLISHABLE_KEY',
    );
    expect(supabaseClient).not.toMatch(
      /SERVICE_ROLE|service_role|SUPABASE_SECRET|secret_key/i,
    );
  });

  it('keeps write modes fail-closed by default', () => {
    expect(env).toContain("productWriteModeSchema.default('blocked')");
    expect(env).toContain("productReadModeSchema.default('blocked')");
  });

  it('keeps Intelligence blocked from SECURITY and RLS bypass autonomy', () => {
    expect(permissionModel).toContain(
      "BYPASS_RLS: 'security.bypass_rls'",
    );
    expect(permissionModel).toContain(
      "principal.actorType === 'INTELLIGENCE'",
    );
    expect(permissionModel).toContain(
      "reason: 'INTELLIGENCE_AUTONOMY_BLOCK'",
    );
    expect(permissionModel).toContain("'READ'");
    expect(permissionModel).toContain("'ANALYZE'");
    expect(permissionModel).toContain("'PROPOSE'");
    expect(matrix).toContain(
      "actor: 'INTELLIGENCE'",
    );
    expect(matrix).toContain(
      "surface: 'RLS_BYPASS'",
    );
  });

  it('preserves explicit human confirmation in the Control Plane', () => {
    expect(controlPlane).toContain('HUMAN_DECISION_NOT_APPROVED');
    expect(controlPlane).toContain('READY_FOR_CONFIRMATION');
    expect(controlPlane).toContain('CONFIRMATION_TOKEN_REQUIRED');
  });

  it('does not add a new migration or runtime authorization bypass', () => {
    expect(matrix).not.toMatch(
      /create policy|alter table|security definer|grant execute|service_role_key/i,
    );
    expect(matrix).not.toMatch(
      /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/i,
    );
  });
});
