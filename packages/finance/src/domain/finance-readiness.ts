import type { CashClosure, FinancialAccount, FinancialMovement } from './finance';

export type FinanceReadinessStatus = 'READY' | 'REVIEW' | 'BLOCKED';

export type FinanceReadinessIssueCode =
  | 'NO_ACTIVE_ACCOUNT'
  | 'MOVEMENT_ACCOUNT_MISSING'
  | 'TRANSFER_PAIR_INVALID'
  | 'REVERSAL_ORIGINAL_MISSING'
  | 'REVERSAL_PAIR_INVALID'
  | 'DUPLICATE_REVERSAL'
  | 'CASH_CLOSURE_VARIANCE';

export interface FinanceReadinessIssue {
  readonly code: FinanceReadinessIssueCode;
  readonly severity: 'WARNING' | 'CRITICAL';
  readonly message: string;
  readonly referenceId: string | null;
}

export interface FinanceReadinessResult {
  readonly status: FinanceReadinessStatus;
  readonly issues: readonly FinanceReadinessIssue[];
  readonly activeAccountCount: number;
  readonly transferCount: number;
  readonly reversalCount: number;
  readonly closureVarianceCount: number;
}

const moneyTolerance = 0.009;

export function evaluateFinanceReadiness(input: {
  readonly accounts: readonly FinancialAccount[];
  readonly movements: readonly FinancialMovement[];
  readonly closures: readonly CashClosure[];
}): FinanceReadinessResult {
  const issues: FinanceReadinessIssue[] = [];
  const accountsById = new Map(input.accounts.map((account) => [account.id, account]));
  const movementsById = new Map(input.movements.map((movement) => [movement.id, movement]));
  const activeAccountCount = input.accounts.filter((account) => account.status === 'ACTIVE').length;

  if (activeAccountCount === 0) {
    issues.push({
      code: 'NO_ACTIVE_ACCOUNT',
      severity: 'CRITICAL',
      message: 'No existe una cuenta financiera activa para nuevas operaciones controladas.',
      referenceId: null,
    });
  }

  for (const movement of input.movements) {
    if (!accountsById.has(movement.accountId)) {
      issues.push({
        code: 'MOVEMENT_ACCOUNT_MISSING',
        severity: 'CRITICAL',
        message: `El movimiento ${movement.id} referencia una cuenta que no está disponible en la lectura financiera.`,
        referenceId: movement.id,
      });
    }
  }

  const transfers = new Map<string, FinancialMovement[]>();
  for (const movement of input.movements) {
    if (movement.referenceType !== 'TRANSFER' || !movement.referenceId) continue;
    const group = transfers.get(movement.referenceId) ?? [];
    group.push(movement);
    transfers.set(movement.referenceId, group);
  }

  for (const [transferId, group] of transfers) {
    const outs = group.filter((movement) => movement.movementType === 'TRANSFER_OUT');
    const ins = group.filter((movement) => movement.movementType === 'TRANSFER_IN');
    const out = outs[0];
    const incoming = ins[0];
    const valid = outs.length === 1
      && ins.length === 1
      && out !== undefined
      && incoming !== undefined
      && out.accountId !== incoming.accountId
      && out.amountSigned < 0
      && incoming.amountSigned > 0
      && Math.abs(out.amountSigned + incoming.amountSigned) <= moneyTolerance;
    if (!valid) {
      issues.push({
        code: 'TRANSFER_PAIR_INVALID',
        severity: 'CRITICAL',
        message: `La transferencia ${transferId} no tiene un par OUT/IN balanceado y trazable.`,
        referenceId: transferId,
      });
    }
  }

  const reversalsByOriginal = new Map<string, FinancialMovement[]>();
  for (const movement of input.movements) {
    if (movement.movementType !== 'REVERSAL') continue;
    if (!movement.reversalOfId) {
      issues.push({
        code: 'REVERSAL_ORIGINAL_MISSING',
        severity: 'CRITICAL',
        message: `La reversión ${movement.id} no identifica el movimiento original.`,
        referenceId: movement.id,
      });
      continue;
    }
    const group = reversalsByOriginal.get(movement.reversalOfId) ?? [];
    group.push(movement);
    reversalsByOriginal.set(movement.reversalOfId, group);
  }

  for (const [originalId, reversals] of reversalsByOriginal) {
    if (reversals.length > 1) {
      issues.push({
        code: 'DUPLICATE_REVERSAL',
        severity: 'CRITICAL',
        message: `El movimiento ${originalId} tiene más de una reversión registrada.`,
        referenceId: originalId,
      });
    }
    const original = movementsById.get(originalId);
    if (!original) {
      issues.push({
        code: 'REVERSAL_ORIGINAL_MISSING',
        severity: 'CRITICAL',
        message: `No se encuentra el movimiento original ${originalId} para validar su reversión.`,
        referenceId: originalId,
      });
      continue;
    }
    for (const reversal of reversals) {
      const valid = (original.movementType === 'EXPENSE' || original.movementType === 'ADJUSTMENT')
        && reversal.accountId === original.accountId
        && Math.abs(reversal.amountSigned + original.amountSigned) <= moneyTolerance;
      if (!valid) {
        issues.push({
          code: 'REVERSAL_PAIR_INVALID',
          severity: 'CRITICAL',
          message: `La reversión ${reversal.id} no compensa exactamente al movimiento ${original.id}.`,
          referenceId: reversal.id,
        });
      }
    }
  }

  const closureVarianceCount = input.closures.filter((closure) => Math.abs(closure.variance) > moneyTolerance).length;
  for (const closure of input.closures) {
    if (Math.abs(closure.variance) <= moneyTolerance) continue;
    issues.push({
      code: 'CASH_CLOSURE_VARIANCE',
      severity: 'WARNING',
      message: `El cierre ${closure.id} presenta una diferencia que requiere investigación, no sobrescritura de saldo.`,
      referenceId: closure.id,
    });
  }

  const status: FinanceReadinessStatus = issues.some((issue) => issue.severity === 'CRITICAL')
    ? 'BLOCKED'
    : issues.length > 0
      ? 'REVIEW'
      : 'READY';

  return {
    status,
    issues,
    activeAccountCount,
    transferCount: transfers.size,
    reversalCount: [...reversalsByOriginal.values()].reduce((sum, group) => sum + group.length, 0),
    closureVarianceCount,
  };
}
