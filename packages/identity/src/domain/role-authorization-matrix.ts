import type { AdminRoleCode } from './admin-role';

export type AdminAuthorityAction =
  | 'READ_GOVERNED'
  | 'CONTROLLED_WRITE'
  | 'MANAGE_AUTHORIZATION';

export interface AdminRoleAuthority {
  readonly readGoverned: boolean;
  readonly controlledWriteBoundary: boolean;
  readonly manageAuthorization: boolean;
}

/**
 * Canonical least-privilege ceiling for Control Center administrative roles.
 *
 * This contract does not bypass feature gates, domain policy, Controlled Commands,
 * RPC authorization or RLS. A `true` value only means that the role may reach that
 * authority boundary when every downstream control also permits the operation.
 */
export const ADMIN_ROLE_AUTHORITY_MATRIX = Object.freeze({
  OWNER: Object.freeze({
    readGoverned: true,
    controlledWriteBoundary: true,
    manageAuthorization: true,
  }),
  ADMIN: Object.freeze({
    readGoverned: true,
    controlledWriteBoundary: true,
    manageAuthorization: false,
  }),
  OPERATOR: Object.freeze({
    readGoverned: true,
    controlledWriteBoundary: false,
    manageAuthorization: false,
  }),
  VIEWER: Object.freeze({
    readGoverned: true,
    controlledWriteBoundary: false,
    manageAuthorization: false,
  }),
} satisfies Readonly<Record<AdminRoleCode, AdminRoleAuthority>>);

export function roleHasAuthority(
  roleCode: AdminRoleCode,
  action: AdminAuthorityAction,
): boolean {
  const authority = ADMIN_ROLE_AUTHORITY_MATRIX[roleCode];

  switch (action) {
    case 'READ_GOVERNED':
      return authority.readGoverned;
    case 'CONTROLLED_WRITE':
      return authority.controlledWriteBoundary;
    case 'MANAGE_AUTHORIZATION':
      return authority.manageAuthorization;
  }
}
