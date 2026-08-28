import type { FinancialAccount, FinancialMovement } from './finance';
import type { FinanceLedgerIntegrityStatus } from './finance-ledger-integrity';
import type { FinanceReadinessStatus } from './finance-readiness';

export type FinanceOperationPolicyStatus = 'ALLOWED' | 'BLOCKED';

export type FinanceOperationPolicyIssueCode =
  | 'FINANCE_READINESS_BLOCKED'
  | 'LEDGER_INTEGRITY_BLOCKED'
  | 'ACCOUNT_REQUIRED'
  | 'ACCOUNT_INACTIVE'
  | 'AMOUNT_INVALID'
  | 'INSUFFICIENT_FUNDS'
  | 'TRANSFER_SAME_ACCOUNT'
  | 'CASH_CLOSURE_COUNT_INVALID'
  | 'CASH_CLOSURE_NOTE_REQUIRED'
  | 'REVERSAL_NOT_ALLOWED'
  | 'REVERSAL_ALREADY_EXISTS';

export interface FinanceOperationPolicyIssue {
  readonly code: FinanceOperationPolicyIssueCode;
  readonly message: string;
}

export interface FinanceOperationPolicyResult {
  readonly status: FinanceOperationPolicyStatus;
  readonly issues: readonly FinanceOperationPolicyIssue[];
}

interface FinanceOperationContext {
  readonly readinessStatus: FinanceReadinessStatus;
  readonly ledgerIntegrityStatus: FinanceLedgerIntegrityStatus;
}

type FinanceOperationPolicyInput =
  | ({
      readonly operation: 'CREATE_ACCOUNT';
    } & FinanceOperationContext)
  | ({
      readonly operation: 'EXPENSE';
      readonly account: FinancialAccount | null;
      readonly amount: number;
    } & FinanceOperationContext)
  | ({
      readonly operation: 'TRANSFER';
      readonly fromAccount: FinancialAccount | null;
      readonly toAccount: FinancialAccount | null;
      readonly amount: number;
    } & FinanceOperationContext)
  | ({
      readonly operation: 'CASH_CLOSURE';
      readonly account: FinancialAccount | null;
      readonly countedBalance: number;
      readonly notes: string | null;
    } & FinanceOperationContext)
  | ({
      readonly operation: 'REVERSAL';
      readonly movement: FinancialMovement;
      readonly ledgerMovements: readonly FinancialMovement[];
    } & FinanceOperationContext);

const moneyTolerance = 0.009;

function validateOperationalContext(
  input: FinanceOperationContext,
  issues: FinanceOperationPolicyIssue[],
): void {
  if (input.ledgerIntegrityStatus === 'BLOCKED') {
    issues.push({
      code: 'LEDGER_INTEGRITY_BLOCKED',
      message: 'La integridad del ledger está bloqueada; no se deben registrar nuevas operaciones ordinarias hasta investigar la diferencia.',
    });
  }
  if (input.readinessStatus === 'BLOCKED') {
    issues.push({
      code: 'FINANCE_READINESS_BLOCKED',
      message: 'El readiness financiero está bloqueado; no se deben registrar nuevas operaciones ordinarias hasta resolver las señales críticas.',
    });
  }
}

function validateActiveAccount(
  account: FinancialAccount | null,
  issues: FinanceOperationPolicyIssue[],
): account is FinancialAccount {
  if (!account) {
    issues.push({ code: 'ACCOUNT_REQUIRED', message: 'La operación requiere una cuenta financiera existente.' });
    return false;
  }
  if (account.status !== 'ACTIVE') {
    issues.push({ code: 'ACCOUNT_INACTIVE', message: `La cuenta ${account.code} no está activa para nuevas operaciones.` });
    return false;
  }
  return true;
}

export function evaluateFinanceOperationPolicy(input: FinanceOperationPolicyInput): FinanceOperationPolicyResult {
  const issues: FinanceOperationPolicyIssue[] = [];

  // Crear una cuenta puede ser precisamente la acción de recuperación cuando no existe una cuenta activa.
  if (input.operation === 'CREATE_ACCOUNT') return { status: 'ALLOWED', issues };

  // Una reversión controlada puede ser parte de la remediación y por eso no hereda el bloqueo general.
  if (input.operation === 'REVERSAL') {
    if (input.movement.movementType !== 'EXPENSE' && input.movement.movementType !== 'ADJUSTMENT') {
      issues.push({
        code: 'REVERSAL_NOT_ALLOWED',
        message: 'Solo EXPENSE y ADJUSTMENT se revierten desde Finanzas; otros tipos requieren su workflow de dominio.',
      });
    }
    if (input.ledgerMovements.some((movement) => movement.reversalOfId === input.movement.id)) {
      issues.push({
        code: 'REVERSAL_ALREADY_EXISTS',
        message: 'El movimiento ya tiene un contramovimiento de reversión registrado.',
      });
    }
    return { status: issues.length > 0 ? 'BLOCKED' : 'ALLOWED', issues };
  }

  validateOperationalContext(input, issues);

  if (input.operation === 'EXPENSE') {
    if (validateActiveAccount(input.account, issues)) {
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        issues.push({ code: 'AMOUNT_INVALID', message: 'El egreso debe tener un valor positivo válido.' });
      } else if (input.amount - input.account.balance > moneyTolerance) {
        issues.push({
          code: 'INSUFFICIENT_FUNDS',
          message: 'El egreso supera el saldo derivado de la cuenta; debe revisarse el origen del faltante antes de registrar la salida.',
        });
      }
    }
  }

  if (input.operation === 'TRANSFER') {
    const fromValid = validateActiveAccount(input.fromAccount, issues);
    const toValid = validateActiveAccount(input.toAccount, issues);
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      issues.push({ code: 'AMOUNT_INVALID', message: 'La transferencia debe tener un valor positivo válido.' });
    }
    if (fromValid && toValid) {
      if (input.fromAccount.id === input.toAccount.id) {
        issues.push({ code: 'TRANSFER_SAME_ACCOUNT', message: 'La cuenta de origen y la cuenta de destino deben ser diferentes.' });
      }
      if (Number.isFinite(input.amount) && input.amount > 0 && input.amount - input.fromAccount.balance > moneyTolerance) {
        issues.push({ code: 'INSUFFICIENT_FUNDS', message: 'La cuenta de origen no tiene saldo suficiente para la transferencia.' });
      }
    }
  }

  if (input.operation === 'CASH_CLOSURE' && validateActiveAccount(input.account, issues)) {
    if (!Number.isFinite(input.countedBalance)) {
      issues.push({ code: 'CASH_CLOSURE_COUNT_INVALID', message: 'El saldo contado debe ser un número válido.' });
    } else if (Math.abs(input.countedBalance - input.account.balance) > moneyTolerance && !input.notes?.trim()) {
      issues.push({
        code: 'CASH_CLOSURE_NOTE_REQUIRED',
        message: 'Un cierre con diferencia requiere una nota que documente la novedad; la nota no corrige el saldo.',
      });
    }
  }

  return { status: issues.length > 0 ? 'BLOCKED' : 'ALLOWED', issues };
}
