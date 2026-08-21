import { describe, expect, it } from 'vitest';
import { canEnterAdminControlCenter, canManageAuthorization, type UserProfile } from '../src';

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  const now = new Date('2026-08-21T00:00:00Z');
  return {
    id: 'user-1',
    email: 'admin@example.com',
    displayName: 'Admin',
    roleCode: 'VIEWER',
    authorizationStatus: 'PENDING',
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('administrative authorization', () => {
  it('does not allow a pending authenticated user into the admin control center', () => {
    expect(canEnterAdminControlCenter(profile())).toBe(false);
  });

  it('allows an active profile into the control center', () => {
    expect(canEnterAdminControlCenter(profile({ authorizationStatus: 'ACTIVE', approvedAt: new Date() }))).toBe(true);
  });

  it('reserves authorization management for an active OWNER', () => {
    expect(canManageAuthorization(profile({ roleCode: 'ADMIN', authorizationStatus: 'ACTIVE', approvedAt: new Date() }))).toBe(false);
    expect(canManageAuthorization(profile({ roleCode: 'OWNER', authorizationStatus: 'ACTIVE', approvedAt: new Date() }))).toBe(true);
  });
});
