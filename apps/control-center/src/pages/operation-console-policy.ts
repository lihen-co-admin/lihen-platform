import type { ControlCenterOperationCatalogEntry, ControlCenterOperationPreview } from '../composition/operations';

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
