export const ADMIN_ROLE_CODES = ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'] as const;
export type AdminRoleCode = (typeof ADMIN_ROLE_CODES)[number];

export function isAdminRoleCode(value: string): value is AdminRoleCode {
  return ADMIN_ROLE_CODES.includes(value as AdminRoleCode);
}
