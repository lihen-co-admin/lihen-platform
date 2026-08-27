import type {
  ControlCenterOperationCatalogEntry,
  ControlCenterOperationDispatchContract,
  ControlCenterOperationExecutionReadiness,
  ControlCenterOperationCanaryExecutionGuard,
  ControlCenterOperationCanarySimulation,
  ControlCenterOperationReleaseAuthorizationGuard,
  Phase87ReleaseGovernanceHardeningClosureReadiness,
  ControlCenterOperationPayloadValidation,
  ControlCenterOperationPreview,
} from '../composition/operations';

export function parseOperationPayload(input: string): Record<string, unknown> {
  const trimmed = input.trim();
  if (!trimmed) return {};
  const parsed: unknown = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('El payload debe ser un objeto JSON.');
  }
  return parsed as Record<string, unknown>;
}

export function operationRiskClass(riskLevel: string): string {
  return riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'status-alert' : 'status-pass';
}

export function canConfirmPreview(preview: ControlCenterOperationPreview | null): boolean {
  return Boolean(
    preview
      && preview.status === 'PREVIEWED'
      && preview.requiresConfirmation
      && preview.executionEnabled === false
      && preview.intentId
      && preview.confirmationToken,
  );
}

export function catalogIsExecutionSafe(entries: readonly ControlCenterOperationCatalogEntry[]): boolean {
  return entries.length > 0 && entries.every((entry) => entry.executionEnabled === false);
}

export function validationMessage(validation: ControlCenterOperationPayloadValidation): string {
  if (validation.valid) return 'Payload válido para PREVIEW. La ejecución continúa deshabilitada.';
  if (validation.missingRequiredKeys.length > 0) {
    return `Faltan campos requeridos: ${validation.missingRequiredKeys.join(', ')}.`;
  }
  if (validation.unexpectedKeys.length > 0) {
    return `Hay campos no esperados: ${validation.unexpectedKeys.join(', ')}.`;
  }
  return `Payload bloqueado: ${validation.validationNote}.`;
}

export function executionReadinessIsHeld(entries: readonly ControlCenterOperationExecutionReadiness[]): boolean {
  return entries.length > 0 && entries.every((entry) =>
    entry.catalogExecutionEnabled === false
    && entry.releaseStatus === 'HELD'
    && entry.allowedEnvironment === 'DEV_ONLY'
    && entry.maxExecutionAttemptsPerHour === 0
    && entry.readinessStatus === 'READY_BUT_HELD'
  );
}


export function dispatchContractsAreHeld(entries: readonly ControlCenterOperationDispatchContract[]): boolean {
  return entries.length > 0 && entries.every((entry) =>
    entry.dispatchAllowed === false
    && entry.releaseStatus === 'HELD'
    && entry.allowedEnvironment === 'DEV_ONLY'
    && entry.maxExecutionAttemptsPerHour === 0
    && entry.dispatchStatus === 'COMPILED_BUT_DISPATCH_HELD'
  );
}

export function canarySimulationIsSafe(entries: readonly ControlCenterOperationCanarySimulation[]): boolean {
  return entries.length > 0 && entries.every((entry) =>
    entry.canaryEnabled === false
    && entry.dispatchAllowed === false
    && entry.maxCanaryAttemptsPerHour === 0
    && (
      entry.simulationStatus === 'SIMULATION_READY_BUT_DISABLED'
      || entry.simulationStatus === 'NOT_ELIGIBLE_BY_RISK'
    )
  );
}


export function canaryExecutionGuardBlocksAll(entries: readonly ControlCenterOperationCanaryExecutionGuard[]): boolean {
  return entries.length > 0 && entries.every((entry) =>
    entry.executionAllowed === false
    && entry.canaryEnabled === false
    && entry.maxCanaryAttemptsPerHour === 0
    && entry.dispatchAllowed === false
    && (
      entry.guardStatus === 'BLOCKED_NO_APPROVAL'
      || entry.guardStatus === 'BLOCKED_BY_RISK'
      || entry.guardStatus === 'BLOCKED_NOT_ELIGIBLE'
    )
  );
}

export function releaseAuthorizationGuardBlocksAll(entries: readonly ControlCenterOperationReleaseAuthorizationGuard[]): boolean {
  return entries.length > 0 && entries.every((entry) =>
    entry.releaseAuthorized === false
    && entry.canaryEnabled === false
    && entry.maxCanaryAttemptsPerHour === 0
    && entry.dispatchAllowed === false
    && entry.guardStatus.startsWith('BLOCKED_')
  );
}

export function canRequestCanaryRelease(entry: ControlCenterOperationCanaryExecutionGuard | null): boolean {
  return Boolean(
    entry
      && entry.riskLevel === 'MEDIUM'
      && entry.canaryEligible
      && entry.canaryEnabled === false
      && entry.maxCanaryAttemptsPerHour === 0
      && entry.approvalRequired
      && entry.approvalState === 'NOT_REQUESTED'
      && entry.dispatchAllowed === false
      && entry.executionAllowed === false
      && entry.guardStatus === 'BLOCKED_NO_APPROVAL',
  );
}


export function releaseGovernanceHardeningIsSafe(
  readiness: Phase87ReleaseGovernanceHardeningClosureReadiness | null,
): boolean {
  return Boolean(
    readiness
      && readiness.readinessStatus === 'PASS'
      && readiness.operations === 14
      && readiness.executionDisabled === 14
      && readiness.canaryDisabled === 14
      && readiness.zeroCanaryBudget === 14
      && readiness.releaseBlocked === 14
      && readiness.pendingRequests === 0
      && readiness.approvedRequests === 0
      && readiness.stalePreviewed === 0
      && readiness.closureMode === 'RELEASE_GOVERNANCE_HARDENED_FINAL_EXECUTION_STILL_NOT_IMPLEMENTED',
  );
}
