import type { InventoryAdjustmentReason } from './inventory-adjustment-reason';

export interface InventoryAdjustmentPolicyInput {
  readonly quantityDelta: number;
  readonly reason: InventoryAdjustmentReason;
  readonly notes: string | null;
}

export interface InventoryAdjustmentPolicyResult {
  readonly allowed: boolean;
  readonly blockers: readonly string[];
  readonly evidenceRequired: boolean;
}

const positiveReasons = new Set<InventoryAdjustmentReason>([
  'PHYSICAL_COUNT_INCREASE',
  'RETURN_TO_STOCK',
]);

const negativeReasons = new Set<InventoryAdjustmentReason>([
  'PHYSICAL_COUNT_DECREASE',
  'DAMAGE_WRITE_OFF',
  'LOSS_WRITE_OFF',
]);

export function evaluateInventoryAdjustmentPolicy(
  input: InventoryAdjustmentPolicyInput,
): InventoryAdjustmentPolicyResult {
  const blockers: string[] = [];
  const notes = input.notes?.trim() ?? '';

  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    blockers.push('La cantidad debe ser un entero distinto de cero.');
  }

  if (positiveReasons.has(input.reason) && input.quantityDelta <= 0) {
    blockers.push('El motivo seleccionado requiere una cantidad positiva.');
  }

  if (negativeReasons.has(input.reason) && input.quantityDelta >= 0) {
    blockers.push('El motivo seleccionado requiere una cantidad negativa.');
  }

  const evidenceRequired = input.reason === 'MANUAL_CORRECTION'
    || input.reason === 'DAMAGE_WRITE_OFF'
    || input.reason === 'LOSS_WRITE_OFF';

  if (evidenceRequired && notes.length < 8) {
    blockers.push('Este motivo exige una nota de evidencia operativa de al menos 8 caracteres.');
  }

  return { allowed: blockers.length === 0, blockers, evidenceRequired };
}
