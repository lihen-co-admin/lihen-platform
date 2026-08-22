import { describe, expect, it } from 'vitest';
import { decideAdminAuthorization } from '../src/auth/authorization';

const activeOwner = {
  id: 'user-1',
  email: 'owner@example.com',
  displayName: null,
  roleCode: 'OWNER',
  authorizationStatus: 'ACTIVE',
} as const;

describe('decideAdminAuthorization', () => {
  it('authorizes an ACTIVE profile whose role exists', () => {
    expect(decideAdminAuthorization(activeOwner, ['OWNER', 'ADMIN'])).toEqual({
      authorized: true,
      reason: 'ACTIVE_ROLE',
    });
  });

  it('rejects a missing profile', () => {
    expect(decideAdminAuthorization(null, ['OWNER'])).toEqual({
      authorized: false,
      reason: 'NO_PROFILE',
    });
  });

  it('rejects a non-active profile', () => {
    expect(
      decideAdminAuthorization({ ...activeOwner, authorizationStatus: 'PENDING' }, ['OWNER']),
    ).toEqual({ authorized: false, reason: 'INACTIVE_PROFILE' });
  });

  it('rejects an unknown role even when the profile is ACTIVE', () => {
    expect(decideAdminAuthorization({ ...activeOwner, roleCode: 'UNKNOWN' }, ['OWNER'])).toEqual({
      authorized: false,
      reason: 'UNKNOWN_ROLE',
    });
  });
});
