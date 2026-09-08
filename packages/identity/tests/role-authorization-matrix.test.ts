import { describe, expect, it } from 'vitest';

import { ADMIN_ROLE_CODES } from '../src/domain/admin-role';
import {
  ADMIN_ROLE_AUTHORITY_MATRIX,
  roleHasAuthority,
} from '../src/domain/role-authorization-matrix';

describe('Admin role authorization matrix', () => {
  it('covers every canonical administrative role exactly once', () => {
    expect(Object.keys(ADMIN_ROLE_AUTHORITY_MATRIX).sort()).toEqual(
      [...ADMIN_ROLE_CODES].sort(),
    );
  });

  it('allows OWNER and ADMIN to reach controlled-write boundaries', () => {
    expect(roleHasAuthority('OWNER', 'CONTROLLED_WRITE')).toBe(true);
    expect(roleHasAuthority('ADMIN', 'CONTROLLED_WRITE')).toBe(true);
  });

  it('keeps OPERATOR and VIEWER outside controlled mutation authority', () => {
    expect(roleHasAuthority('OPERATOR', 'CONTROLLED_WRITE')).toBe(false);
    expect(roleHasAuthority('VIEWER', 'CONTROLLED_WRITE')).toBe(false);
  });

  it('reserves authorization management for OWNER', () => {
    expect(roleHasAuthority('OWNER', 'MANAGE_AUTHORIZATION')).toBe(true);
    expect(roleHasAuthority('ADMIN', 'MANAGE_AUTHORIZATION')).toBe(false);
    expect(roleHasAuthority('OPERATOR', 'MANAGE_AUTHORIZATION')).toBe(false);
    expect(roleHasAuthority('VIEWER', 'MANAGE_AUTHORIZATION')).toBe(false);
  });

  it('keeps governed read capability available to every active recognized role', () => {
    for (const role of ADMIN_ROLE_CODES) {
      expect(roleHasAuthority(role, 'READ_GOVERNED')).toBe(true);
    }
  });
});
