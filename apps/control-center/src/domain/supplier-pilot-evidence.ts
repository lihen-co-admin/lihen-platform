export type SupplierPilotEvidenceStatus =
  | 'CONFIRMED'
  | 'MISSING'
  | 'NEEDS_RUNTIME_PROOF';

export interface SupplierPilotEvidenceItem {
  readonly key:
    | 'CONTROLLED_MODE'
    | 'CONTROLLED_RPC'
    | 'OPERATION_KEY'
    | 'AUTHORIZATION'
    | 'AUDIT_TRAIL'
    | 'COMPENSATION'
    | 'ISOLATED_FIXTURE'
    | 'POST_WRITE_READ'
    | 'IDEMPOTENCY_REPLAY'
    | 'PROD_UNTOUCHED';
  readonly status: SupplierPilotEvidenceStatus;
  readonly note: string;
}

export interface SupplierPilotEvidenceSummary {
  readonly items: readonly SupplierPilotEvidenceItem[];
  readonly sourceConfirmed: number;
  readonly runtimeProofPending: number;
  readonly missing: number;
  readonly readyForFirstMutation: boolean;
  readonly executionPlaneMustRemainHeld: true;
}

/**
 * El preflight solo queda listo cuando no existen vacíos ni pruebas runtime
 * pendientes. Este helper no ejecuta writes ni cambia configuración.
 */
export function summarizeSupplierPilotEvidence(
  items: readonly SupplierPilotEvidenceItem[],
): SupplierPilotEvidenceSummary {
  const sourceConfirmed = items.filter((item) => item.status === 'CONFIRMED').length;
  const runtimeProofPending = items.filter(
    (item) => item.status === 'NEEDS_RUNTIME_PROOF',
  ).length;
  const missing = items.filter((item) => item.status === 'MISSING').length;

  return {
    items,
    sourceConfirmed,
    runtimeProofPending,
    missing,
    readyForFirstMutation:
      items.length === 10 && runtimeProofPending === 0 && missing === 0,
    executionPlaneMustRemainHeld: true,
  };
}
