export type DevPilotReadiness =
  | 'READY_FOR_DEV_PILOT'
  | 'EVIDENCE_INCOMPLETE'
  | 'NOT_A_PILOT_TARGET';

export type DevPilotCapability =
  | 'PRODUCT_MASTER'
  | 'INVENTORY'
  | 'SUPPLIERS'
  | 'PROCUREMENT'
  | 'ORDERS'
  | 'SALES'
  | 'FINANCE'
  | 'OPERATION_DISPATCH'
  | 'CANARY'
  | 'FINAL_RELEASE'
  | 'PRODUCTION';

export interface DevActivationEvidence {
  readonly supabaseDevConfirmed: boolean;
  readonly controlledModeExplicit: boolean;
  readonly controlledRpcConfirmed: boolean;
  readonly authorizationPolicyConfirmed: boolean;
  readonly auditTraceConfirmed: boolean;
  readonly idempotencyConfirmed: boolean;
  readonly compensationPlanConfirmed: boolean;
  readonly isolatedFixtureConfirmed: boolean;
  readonly productionUntouchedConfirmed: boolean;
}

export interface DevActivationPreflightResult {
  readonly capability: DevPilotCapability;
  readonly readiness: DevPilotReadiness;
  readonly missingEvidence: readonly (keyof DevActivationEvidence)[];
  readonly mayEnableControlledMode: boolean;
  readonly executionPlaneMustRemainHeld: true;
}

const NON_PILOT_TARGETS: readonly DevPilotCapability[] = [
  'OPERATION_DISPATCH',
  'CANARY',
  'FINAL_RELEASE',
  'PRODUCTION',
];

const REQUIRED_EVIDENCE: readonly (keyof DevActivationEvidence)[] = [
  'supabaseDevConfirmed',
  'controlledModeExplicit',
  'controlledRpcConfirmed',
  'authorizationPolicyConfirmed',
  'auditTraceConfirmed',
  'idempotencyConfirmed',
  'compensationPlanConfirmed',
  'isolatedFixtureConfirmed',
  'productionUntouchedConfirmed',
];

/**
 * Preflight puro: no lee .env, no cambia flags y no ejecuta RPCs.
 * Solo determina si existe evidencia suficiente para autorizar un piloto DEV
 * posterior y separado.
 */
export function evaluateDevActivationPreflight(
  capability: DevPilotCapability,
  evidence: DevActivationEvidence,
): DevActivationPreflightResult {
  if (NON_PILOT_TARGETS.includes(capability)) {
    return {
      capability,
      readiness: 'NOT_A_PILOT_TARGET',
      missingEvidence: [],
      mayEnableControlledMode: false,
      executionPlaneMustRemainHeld: true,
    };
  }

  const missingEvidence = REQUIRED_EVIDENCE.filter((key) => !evidence[key]);

  return {
    capability,
    readiness: missingEvidence.length === 0 ? 'READY_FOR_DEV_PILOT' : 'EVIDENCE_INCOMPLETE',
    missingEvidence,
    mayEnableControlledMode: missingEvidence.length === 0,
    executionPlaneMustRemainHeld: true,
  };
}

export function blankDevActivationEvidence(): DevActivationEvidence {
  return {
    supabaseDevConfirmed: false,
    controlledModeExplicit: false,
    controlledRpcConfirmed: false,
    authorizationPolicyConfirmed: false,
    auditTraceConfirmed: false,
    idempotencyConfirmed: false,
    compensationPlanConfirmed: false,
    isolatedFixtureConfirmed: false,
    productionUntouchedConfirmed: false,
  };
}
