import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const permissionPath = join(
  root,
  'packages/intelligence-core/src/permission-model.ts',
);

describe('Intelligence Permission Model architecture — GAP-004', () => {
  it('remains independent from React, Supabase, database and Identity role implementation', () => {
    const source = readFileSync(permissionPath, 'utf8');

    expect(source).not.toMatch(/from\s+['"]react['"]/);
    expect(source).not.toMatch(/@supabase\//);
    expect(source).not.toMatch(/@lihen\/database/);
    expect(source).not.toMatch(/@lihen\/identity/);
  });

  it('does not embed current platform role codes as the permission model', () => {
    const source = readFileSync(permissionPath, 'utf8');

    expect(source).not.toMatch(/['"]OWNER['"]|['"]ADMIN['"]|['"]OPERATOR['"]|['"]VIEWER['"]/);
  });

  it('contains no persistence or controlled-operation execution', () => {
    const source = readFileSync(permissionPath, 'utf8');

    expect(source).not.toMatch(/\.(?:insert|update|delete|upsert|rpc)\s*\(/);
    expect(source).not.toMatch(
      /getBrowserSupabaseClient|prepare_control_center_operation|confirm_control_center_operation/,
    );
  });

  it('keeps permission vocabulary extensible instead of closing it to current domains', () => {
    const source = readFileSync(permissionPath, 'utf8');

    expect(source).toContain('export type PermissionKey = `${string}.${string}`;');
    expect(source).toContain('definePermissionKey');
  });

  it('keeps Intelligence autonomy limited to read/analyze/propose classes', () => {
    const source = readFileSync(permissionPath, 'utf8');

    expect(source).toContain("'READ'");
    expect(source).toContain("'ANALYZE'");
    expect(source).toContain("'PROPOSE'");
    expect(source).toContain('INTELLIGENCE_AUTONOMY_BLOCK');
  });
});
