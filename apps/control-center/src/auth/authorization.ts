export interface AdminAuthorizationProfile {
  readonly id: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly roleCode: string;
  readonly authorizationStatus: string;
}

export interface AdminAuthorizationDecision {
  readonly authorized: boolean;
  readonly reason: 'ACTIVE_ROLE' | 'NO_PROFILE' | 'INACTIVE_PROFILE' | 'UNKNOWN_ROLE';
}

export function decideAdminAuthorization(
  profile: AdminAuthorizationProfile | null,
  knownRoleCodes: readonly string[],
): AdminAuthorizationDecision {
  if (!profile) return { authorized: false, reason: 'NO_PROFILE' };
  if (profile.authorizationStatus !== 'ACTIVE') {
    return { authorized: false, reason: 'INACTIVE_PROFILE' };
  }
  if (!knownRoleCodes.includes(profile.roleCode)) {
    return { authorized: false, reason: 'UNKNOWN_ROLE' };
  }
  return { authorized: true, reason: 'ACTIVE_ROLE' };
}
