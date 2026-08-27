import type {
  ControlCenterOperationCatalogEntry,
  ControlCenterOperationDispatchContract,
  ControlCenterOperationExecutionReadiness,
  ControlCenterOperationCanarySimulation,
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
