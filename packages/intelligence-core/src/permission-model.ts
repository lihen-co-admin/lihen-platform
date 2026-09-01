/**
 * LIHEN Intelligence Permission Model — GAP-004
 *
 * Pure authorization contracts and deterministic evaluation.
 * This module does not map database roles, bypass RLS, execute commands, or decide
 * business risk. It gives the future Orchestrator a default-deny permission boundary.
 */

export type PermissionKey = `${string}.${string}`;

export type PermissionEffect = 'ALLOW' | 'DENY';

export type PermissionActionClass =
  | 'READ'
  | 'ANALYZE'
  | 'PROPOSE'
  | 'APPROVE'
  | 'MUTATE_MASTER'
  | 'PUBLISH'
  | 'FINANCE'
  | 'LIFECYCLE'
  | 'SECURITY';

export type PermissionActorType = 'HUMAN' | 'SYSTEM' | 'INTELLIGENCE';

export interface PermissionScope {
  readonly domain?: string;
  readonly businessLine?: 'BEAUTY_CARE' | 'STYLE';
  readonly entityType?: string;
  readonly entityId?: string;
}

export interface PermissionGrant {
  readonly permission: PermissionKey;
  readonly effect: PermissionEffect;
  readonly scope?: PermissionScope;
  readonly source: string;
}

export interface PermissionPrincipal {
  readonly actorId: string;
  readonly actorType: PermissionActorType;
  readonly grants: readonly PermissionGrant[];
}

export interface PermissionRequest {
  readonly permission: PermissionKey;
  readonly actionClass: PermissionActionClass;
  readonly scope?: PermissionScope;
}

export type PermissionDecisionReason =
  | 'EXPLICIT_DENY'
  | 'MISSING_GRANT'
  | 'INTELLIGENCE_AUTONOMY_BLOCK'
  | 'GRANT_ALLOWED';

export interface PermissionDecision {
  readonly allowed: boolean;
  readonly permission: PermissionKey;
  readonly actionClass: PermissionActionClass;
  readonly reason: PermissionDecisionReason;
  readonly matchedGrant?: PermissionGrant;
}

export const INTELLIGENCE_PERMISSION = {
  READ_CONTEXT: 'intelligence.read_context',
  SEARCH_EXTERNAL: 'intelligence.search_external',
  ANALYZE: 'intelligence.analyze',
  EXTRACT: 'intelligence.extract',
  COMPARE: 'intelligence.compare',
  VERIFY: 'intelligence.verify',
  GENERATE: 'intelligence.generate',
  CREATE_EVIDENCE: 'intelligence.create_evidence',
  CREATE_CANDIDATE: 'intelligence.create_candidate',
  CREATE_RECOMMENDATION: 'intelligence.create_recommendation',
  CREATE_REPORT: 'intelligence.create_report',
  PREPARE_ACTION: 'intelligence.prepare_action',
} as const satisfies Readonly<Record<string, PermissionKey>>;

export const GOVERNED_PERMISSION = {
  APPROVE_CHANGE: 'governance.approve_change',
  MUTATE_MASTER_DATA: 'governance.mutate_master_data',
  CHANGE_PRICE: 'pricing.change_sale_price',
  POST_INVENTORY: 'inventory.post_movement',
  POST_PURCHASE: 'procurement.post_purchase',
  POST_SALE: 'sales.post_sale',
  POST_FINANCE: 'finance.post_entry',
  CHANGE_LIFECYCLE: 'governance.change_lifecycle',
  PUBLISH: 'publication.publish',
  DELETE_CANONICAL_DATA: 'governance.delete_canonical_data',
  BYPASS_RLS: 'security.bypass_rls',
} as const satisfies Readonly<Record<string, PermissionKey>>;

export const INTELLIGENCE_AUTONOMY_ALLOWED_CLASSES = [
  'READ',
  'ANALYZE',
  'PROPOSE',
] as const satisfies readonly PermissionActionClass[];

function scopeMatches(
  grantScope: PermissionScope | undefined,
  requestScope: PermissionScope | undefined,
): boolean {
  if (!grantScope) return true;
  if (!requestScope) return false;

  return (
    (grantScope.domain === undefined || grantScope.domain === requestScope.domain)
    && (grantScope.businessLine === undefined || grantScope.businessLine === requestScope.businessLine)
    && (grantScope.entityType === undefined || grantScope.entityType === requestScope.entityType)
    && (grantScope.entityId === undefined || grantScope.entityId === requestScope.entityId)
  );
}

function matchingGrants(
  principal: PermissionPrincipal,
  request: PermissionRequest,
): readonly PermissionGrant[] {
  return principal.grants.filter(
    (grant) => grant.permission === request.permission && scopeMatches(grant.scope, request.scope),
  );
}

export function evaluatePermission(
  principal: PermissionPrincipal,
  request: PermissionRequest,
): PermissionDecision {
  const matches = matchingGrants(principal, request);
  const denied = matches.find((grant) => grant.effect === 'DENY');

  if (denied) {
    return {
      allowed: false,
      permission: request.permission,
      actionClass: request.actionClass,
      reason: 'EXPLICIT_DENY',
      matchedGrant: denied,
    };
  }

  if (
    principal.actorType === 'INTELLIGENCE'
    && !INTELLIGENCE_AUTONOMY_ALLOWED_CLASSES.includes(
      request.actionClass as (typeof INTELLIGENCE_AUTONOMY_ALLOWED_CLASSES)[number],
    )
  ) {
    return {
      allowed: false,
      permission: request.permission,
      actionClass: request.actionClass,
      reason: 'INTELLIGENCE_AUTONOMY_BLOCK',
    };
  }

  const allowed = matches.find((grant) => grant.effect === 'ALLOW');

  if (!allowed) {
    return {
      allowed: false,
      permission: request.permission,
      actionClass: request.actionClass,
      reason: 'MISSING_GRANT',
    };
  }

  return {
    allowed: true,
    permission: request.permission,
    actionClass: request.actionClass,
    reason: 'GRANT_ALLOWED',
    matchedGrant: allowed,
  };
}

export function definePermissionKey(domain: string, action: string): PermissionKey {
  const normalizedDomain = domain.trim().toLowerCase();
  const normalizedAction = action.trim().toLowerCase();

  if (
    !normalizedDomain
    || !normalizedAction
    || normalizedDomain.includes('.')
    || normalizedAction.includes('.')
  ) {
    throw new Error('Permission key requires non-empty dot-free domain and action segments.');
  }

  return `${normalizedDomain}.${normalizedAction}`;
}
