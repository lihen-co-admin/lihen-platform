export const AUTHORIZATION_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED'] as const;
export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number];

export function isAuthorizationStatus(value: string): value is AuthorizationStatus {
  return AUTHORIZATION_STATUSES.includes(value as AuthorizationStatus);
}
