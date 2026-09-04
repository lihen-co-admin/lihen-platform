export type SecurityActorClass =
  | 'BROWSER_AUTHENTICATED'
  | 'SERVER_SERVICE_ROLE'
  | 'INTELLIGENCE';

export type SecuritySurface =
  | 'PUBLIC_TABLE_READ'
  | 'DIRECT_TABLE_WRITE'
  | 'CONTROLLED_RPC_EXECUTE'
  | 'SERVICE_MAINTENANCE'
  | 'RLS_BYPASS';

export type SecurityBoundaryDecision =
  | 'ALLOW'
  | 'DENY'
  | 'CONDITIONAL';

export interface RlsPermissionMatrixEntry {
  readonly actor: SecurityActorClass;
  readonly surface: SecuritySurface;
  readonly decision: SecurityBoundaryDecision;
  readonly rationale: string;
}

export const RLS_PERMISSION_MATRIX_VNEXT = [
  {
    actor: 'BROWSER_AUTHENTICATED',
    surface: 'PUBLIC_TABLE_READ',
    decision: 'CONDITIONAL',
    rationale:
      'Browser reads remain subject to deployed RLS/policies and authenticated profile authorization.',
  },
  {
    actor: 'BROWSER_AUTHENTICATED',
    surface: 'DIRECT_TABLE_WRITE',
    decision: 'DENY',
    rationale:
      'Browser write paths must use controlled RPCs instead of direct table mutation.',
  },
  {
    actor: 'BROWSER_AUTHENTICATED',
    surface: 'CONTROLLED_RPC_EXECUTE',
    decision: 'CONDITIONAL',
    rationale:
      'Controlled RPC execution is permitted only when the RPC performs its own authenticated authorization checks.',
  },
  {
    actor: 'BROWSER_AUTHENTICATED',
    surface: 'SERVICE_MAINTENANCE',
    decision: 'DENY',
    rationale:
      'Service-role maintenance credentials must never be exposed to the browser.',
  },
  {
    actor: 'BROWSER_AUTHENTICATED',
    surface: 'RLS_BYPASS',
    decision: 'DENY',
    rationale:
      'Browser clients may not bypass Row Level Security.',
  },
  {
    actor: 'SERVER_SERVICE_ROLE',
    surface: 'PUBLIC_TABLE_READ',
    decision: 'CONDITIONAL',
    rationale:
      'Server-side service operations may read only where explicitly granted for controlled infrastructure tasks.',
  },
  {
    actor: 'SERVER_SERVICE_ROLE',
    surface: 'DIRECT_TABLE_WRITE',
    decision: 'CONDITIONAL',
    rationale:
      'Server-side service operations require explicit grants and controlled tooling; this is not a browser permission.',
  },
  {
    actor: 'SERVER_SERVICE_ROLE',
    surface: 'CONTROLLED_RPC_EXECUTE',
    decision: 'CONDITIONAL',
    rationale:
      'Service-role RPC execution is limited to explicitly granted controlled infrastructure functions.',
  },
  {
    actor: 'SERVER_SERVICE_ROLE',
    surface: 'SERVICE_MAINTENANCE',
    decision: 'CONDITIONAL',
    rationale:
      'Service-role access is reserved for trusted server/tooling contexts and explicit maintenance grants.',
  },
  {
    actor: 'SERVER_SERVICE_ROLE',
    surface: 'RLS_BYPASS',
    decision: 'CONDITIONAL',
    rationale:
      'Any service-role RLS bypass is infrastructure-only and never grants authority to Intelligence or browser actors.',
  },
  {
    actor: 'INTELLIGENCE',
    surface: 'PUBLIC_TABLE_READ',
    decision: 'CONDITIONAL',
    rationale:
      'Intelligence consumes governed context/read projections rather than unrestricted database access.',
  },
  {
    actor: 'INTELLIGENCE',
    surface: 'DIRECT_TABLE_WRITE',
    decision: 'DENY',
    rationale:
      'Intelligence cannot directly mutate canonical tables.',
  },
  {
    actor: 'INTELLIGENCE',
    surface: 'CONTROLLED_RPC_EXECUTE',
    decision: 'DENY',
    rationale:
      'Intelligence may propose/prepare actions but cannot autonomously execute controlled mutation RPCs.',
  },
  {
    actor: 'INTELLIGENCE',
    surface: 'SERVICE_MAINTENANCE',
    decision: 'DENY',
    rationale:
      'Intelligence never receives service-role maintenance authority.',
  },
  {
    actor: 'INTELLIGENCE',
    surface: 'RLS_BYPASS',
    decision: 'DENY',
    rationale:
      'Intelligence may never bypass Row Level Security.',
  },
] as const satisfies readonly RlsPermissionMatrixEntry[];

export function evaluateSecurityBoundary(
  actor: SecurityActorClass,
  surface: SecuritySurface,
): RlsPermissionMatrixEntry {
  const match = RLS_PERMISSION_MATRIX_VNEXT.find(
    (entry) => entry.actor === actor && entry.surface === surface,
  );

  if (!match) {
    return {
      actor,
      surface,
      decision: 'DENY',
      rationale: 'Unspecified security boundary combinations fail closed.',
    };
  }

  return match;
}
