import type { CashClosure, FinancialAccount, FinancialMovement } from './finance';

export type FinanceLedgerIntegrityStatus = 'PASS' | 'REVIEW' | 'BLOCKED';

export type FinanceLedgerIntegrityIssueCode =
  | 'ACCOUNT_BALANCE_MISMATCH'
  | 'CLOSURE_ACCOUNT_MISSING'
  | 'CLOSURE_EXPECTED_BALANCE_MISMATCH'
  | 'CLOSURE_VARIANCE';

export interface FinanceLedgerIntegrityIssue {
  readonly code: FinanceLedgerIntegrityIssueCode;
  readonly severity: 'WARNING' | 'CRITICAL';
  readonly message: string;
  readonly referenceId: string | null;
}

export interface FinanceLedgerAccountCheck {
  readonly accountId: string;
  readonly reportedBalance: number;
  readonly derivedBalance: number;
  readonly delta: number;
}

export interface FinanceLedgerIntegrityResult {
  readonly status: FinanceLedgerIntegrityStatus;
  readonly issues: readonly FinanceLedgerIntegrityIssue[];
  readonly accountChecks: readonly FinanceLedgerAccountCheck[];
  readonly movementCount: number;
  readonly closureCount: number;
}

const moneyTolerance = 0.009;

export function evaluateFinanceLedgerIntegrity(input: {
  readonly accounts: readonly FinancialAccount[];
  readonly movements: readonly FinancialMovement[];
  readonly closures: readonly CashClosure[];
}): FinanceLedgerIntegrityResult {
  const issues: FinanceLedgerIntegrityIssue[] = [];
  const accountsById = new Map(input.accounts.map((account) => [account.id, account]));
  const movementsByAccount = new Map<string, FinancialMovement[]>();

  for (const movement of input.movements) {
    const group = movementsByAccount.get(movement.accountId) ?? [];
    group.push(movement);
    movementsByAccount.set(movement.accountId, group);
  }

  const accountChecks = input.accounts.map((account): FinanceLedgerAccountCheck => {
    const derivedBalance = (movementsByAccount.get(account.id) ?? []).reduce(
      (sum, movement) => sum + movement.amountSigned,
      0,
    );
    const delta = account.balance - derivedBalance;
    if (Math.abs(delta) > moneyTolerance) {
      issues.push({
        code: 'ACCOUNT_BALANCE_MISMATCH',
        severity: 'CRITICAL',
        message: `La cuenta ${account.code} reporta un saldo que no coincide con la suma completa de su ledger.`,
        referenceId: account.id,
      });
    }
    return {
      accountId: account.id,
      reportedBalance: account.balance,
      derivedBalance,
      delta,
    };
  });

  for (const closure of input.closures) {
    const account = accountsById.get(closure.accountId);
    if (!account) {
      issues.push({
        code: 'CLOSURE_ACCOUNT_MISSING',
        severity: 'CRITICAL',
        message: `El cierre ${closure.id} referencia una cuenta que no está disponible en la lectura financiera.`,
        referenceId: closure.id,
      });
      continue;
    }

    const expectedFromLedger = (movementsByAccount.get(account.id) ?? [])
      .filter((movement) => movement.occurredAt.getTime() <= closure.occurredAt.getTime())
      .reduce((sum, movement) => sum + movement.amountSigned, 0);

    if (Math.abs(closure.expectedBalance - expectedFromLedger) > moneyTolerance) {
      issues.push({
        code: 'CLOSURE_EXPECTED_BALANCE_MISMATCH',
        severity: 'CRITICAL',
        message: `El cierre ${closure.id} no conserva el saldo esperado que resulta del ledger hasta su fecha de corte.`,
        referenceId: closure.id,
      });
    }

    if (Math.abs(closure.variance) > moneyTolerance) {
      issues.push({
        code: 'CLOSURE_VARIANCE',
        severity: 'WARNING',
        message: `El cierre ${closure.id} tiene diferencia entre saldo esperado y saldo contado; requiere investigación trazable.`,
        referenceId: closure.id,
      });
    }
  }

  const status: FinanceLedgerIntegrityStatus = issues.some((issue) => issue.severity === 'CRITICAL')
    ? 'BLOCKED'
    : issues.length > 0
      ? 'REVIEW'
      : 'PASS';

  return {
    status,
    issues,
    accountChecks,
    movementCount: input.movements.length,
    closureCount: input.closures.length,
  };
}
