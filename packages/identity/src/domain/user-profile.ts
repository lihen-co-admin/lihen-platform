import type { AdminRoleCode } from './admin-role';
import type { AuthorizationStatus } from './authorization-status';

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  roleCode: AdminRoleCode;
  authorizationStatus: AuthorizationStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function canEnterAdminControlCenter(profile: UserProfile): boolean {
  return profile.authorizationStatus === 'ACTIVE';
}

export function canManageAuthorization(profile: UserProfile): boolean {
  return profile.authorizationStatus === 'ACTIVE' && profile.roleCode === 'OWNER';
}
