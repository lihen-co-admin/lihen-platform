import { describe, expect, it } from 'vitest';
import { evaluateFinanceReadiness, type CashClosure, type FinancialAccount, type FinancialMovement } from '../src';

const account: FinancialAccount = {
  id: 'account-1',
  code: 'CASH',
  name: 'Caja',
  accountType: 'CASH',
  currency: 'COP',
  status: 'ACTIVE',
  balance: 100,
};

const movement = (overrides: Partial<FinancialMovement> = {}): FinancialMovement => ({
  id: 'movement-1',
  accountId: account.id,
  movementType: 'EXPENSE',
  amountSigned: -10,
  currency: 'COP',
  occurredAt: new Date(0),
  description: 'Test',
  referenceType: null,
  referenceId: null,
  reversalOfId: null,
  ...overrides,
});

const closure = (variance = 0): CashClosure => ({
  id: 'closure-1',
  accountId: account.id,
  expectedBalance: 100,
  countedBalance: 100 + variance,
  variance,
  occurredAt: new Date(0),
  notes: null,
});

describe('finance readiness', () => {
  it('is ready for an active account with balanced history', () => {
    const result = evaluateFinanceReadiness({ accounts: [account], movements: [], closures: [closure()] });
    expect(result.status).toBe('READY');
  });

  it('blocks when no active account exists', () => {
    const result = evaluateFinanceReadiness({ accounts: [{ ...account, status: 'INACTIVE' }], movements: [], closures: [] });
    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'NO_ACTIVE_ACCOUNT')).toBe(true);
  });

  it('validates a balanced transfer pair', () => {
    const second = { ...account, id: 'account-2', code: 'BANK', name: 'Banco', accountType: 'BANK' as const };
    const result = evaluateFinanceReadiness({
      accounts: [account, second],
      movements: [
        movement({ id: 'out', movementType: 'TRANSFER_OUT', amountSigned: -50, referenceType: 'TRANSFER', referenceId: 'transfer-1' }),
        movement({ id: 'in', accountId: second.id, movementType: 'TRANSFER_IN', amountSigned: 50, referenceType: 'TRANSFER', referenceId: 'transfer-1' }),
      ],
      closures: [],
    });
    expect(result.status).toBe('READY');
    expect(result.transferCount).toBe(1);
  });

  it('blocks an unbalanced transfer pair', () => {
    const result = evaluateFinanceReadiness({
      accounts: [account],
      movements: [movement({ id: 'out', movementType: 'TRANSFER_OUT', amountSigned: -50, referenceType: 'TRANSFER', referenceId: 'transfer-1' })],
      closures: [],
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'TRANSFER_PAIR_INVALID')).toBe(true);
  });

  it('validates a single exact reversal and blocks duplicates', () => {
    const original = movement({ id: 'expense-1', amountSigned: -25 });
    const reversal = movement({ id: 'reversal-1', movementType: 'REVERSAL', amountSigned: 25, reversalOfId: original.id });
    const good = evaluateFinanceReadiness({ accounts: [account], movements: [original, reversal], closures: [] });
    expect(good.status).toBe('READY');

    const duplicate = evaluateFinanceReadiness({
      accounts: [account],
      movements: [original, reversal, { ...reversal, id: 'reversal-2' }],
      closures: [],
    });
    expect(duplicate.status).toBe('BLOCKED');
    expect(duplicate.issues.some((issue) => issue.code === 'DUPLICATE_REVERSAL')).toBe(true);
  });

  it('marks closure variance for review without mutating ledger truth', () => {
    const result = evaluateFinanceReadiness({ accounts: [account], movements: [], closures: [closure(5)] });
    expect(result.status).toBe('REVIEW');
    expect(result.closureVarianceCount).toBe(1);
  });
});
