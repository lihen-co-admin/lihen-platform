import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('GAP-045 role authorization assurance', () => {
  it('keeps authorization management OWNER-only in Identity', () => {
    const identity = source('packages/identity/src/domain/user-profile.ts');

    expect(identity).toContain("profile.roleCode === 'OWNER'");
  });

  it('keeps the central controlled-operation catalog on OWNER/ADMIN authority', () => {
    const migration = source(
      'database/migrations/20260826215000_phase6_1a_control_center_operation_catalog_foundation.sql',
    );

    expect(migration).toMatch(/OWNER/);
    expect(migration).toMatch(/ADMIN/);
    expect(migration).not.toMatch(/\bOPERATOR\b/);
    expect(migration).not.toMatch(/\bVIEWER\b/);
  });

  it('keeps controlled product-image writes on OWNER/ADMIN authority', () => {
    const migration = source(
      'database/migrations/20260821143058_product_image_controlled_write_foundation.sql',
    );

    expect(migration).toMatch(/OWNER/);
    expect(migration).toMatch(/ADMIN/);
    expect(migration).not.toMatch(/\bOPERATOR\b/);
    expect(migration).not.toMatch(/\bVIEWER\b/);
  });

  it('keeps Intelligence permissions independent from administrative role codes', () => {
    const permissions = source(
      'packages/intelligence-core/src/permission-model.ts',
    );

    expect(permissions).not.toMatch(
      /['"]OWNER['"]|['"]ADMIN['"]|['"]OPERATOR['"]|['"]VIEWER['"]/,
    );
  });
});
