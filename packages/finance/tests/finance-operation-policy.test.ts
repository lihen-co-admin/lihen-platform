import { describe, expect, it } from 'vitest';
import { evaluateFinanceOperationPolicy, type FinancialAccount, type FinancialMovement } from '../src';

const account: FinancialAccount = {
  id: 'account-1',
  code: 'CAJA',
  name: 'Caja',
  accountType: 'CASH',
  currency: 'COP',
  status: 'ACTIVE',
  balance: 100_000,
};

const expense: FinancialMovement = {
  id: 'expense-1',
  accountId: account.id,
  movementType: 'EXPENSE',
  amountSigned: -20_000,
  currency: 'COP',
  occurredAt: new Date('2026-08-27T15:00:00Z'),
  description: 'Compra operativa',
  referenceType: 'MANUAL_EXPENSE',
  referenceId: null,
  reversalOfId: null,
};

const context = { readinessStatus: 'READY' as const, ledgerIntegrityStatus: 'PASS' as const };

describe('evaluateFinanceOperationPolicy', () => {
  it('permite crear una cuenta incluso si readiness está bloqueado', () => {
    const result = evaluateFinanceOperationPolicy({
      operation: 'CREATE_ACCOUNT',
      readinessStatus: 'BLOCKED',
      ledgerIntegrityStatus: 'BLOCKED',
    });
    expect(result.status).toBe('ALLOWED');
  });

  it('bloquea nuevas operaciones ordinarias si el ledger está bloqueado', () => {
    const result = evaluateFinanceOperationPolicy({
      operation: 'EXPENSE',
      account,
      amount: 10_000,
      readinessStatus: 'READY',
      ledgerIntegrityStatus: 'BLOCKED',
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.issues.map((issue) => issue.code)).toContain('LEDGER_INTEGRITY_BLOCKED');
  });

  it('bloquea un egreso que supera el saldo derivado', () => {
    const result = evaluateFinanceOperationPolicy({ operation: 'EXPENSE', account, amount: 120_000, ...context });
    expect(result.status).toBe('BLOCKED');
    expect(result.issues.map((issue) => issue.code)).toContain('INSUFFICIENT_FUNDS');
  });

  it('exige nota en un cierre con diferencia', () => {
    const result = evaluateFinanceOperationPolicy({
      operation: 'CASH_CLOSURE',
      account,
      countedBalance: 95_000,
      notes: null,
      ...context,
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.issues.map((issue) => issue.code)).toContain('CASH_CLOSURE_NOTE_REQUIRED');
  });

  it('permite una reversión válida aun cuando el readiness general esté bloqueado', () => {
    const result = evaluateFinanceOperationPolicy({
      operation: 'REVERSAL',
      movement: expense,
      ledgerMovements: [expense],
      readinessStatus: 'BLOCKED',
      ledgerIntegrityStatus: 'BLOCKED',
    });
    expect(result.status).toBe('ALLOWED');
  });

  it('bloquea una segunda reversión del mismo movimiento', () => {
    const reversal: FinancialMovement = {
      ...expense,
      id: 'reversal-1',
      movementType: 'REVERSAL',
      amountSigned: 20_000,
      reversalOfId: expense.id,
    };
    const result = evaluateFinanceOperationPolicy({
      operation: 'REVERSAL',
      movement: expense,
      ledgerMovements: [expense, reversal],
      ...context,
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.issues.map((issue) => issue.code)).toContain('REVERSAL_ALREADY_EXISTS');
  });
});
