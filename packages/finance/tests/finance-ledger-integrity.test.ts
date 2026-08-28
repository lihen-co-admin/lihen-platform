import { describe, expect, it } from 'vitest';
import {
  evaluateFinanceLedgerIntegrity,
  type CashClosure,
  type FinancialAccount,
  type FinancialMovement,
} from '../src';

const account: FinancialAccount = {
  id: 'account-1',
  code: 'CASH',
  name: 'Caja',
  accountType: 'CASH',
  currency: 'COP',
  status: 'ACTIVE',
  balance: 90,
};

const movement = (overrides: Partial<FinancialMovement> = {}): FinancialMovement => ({
  id: 'movement-1',
  accountId: account.id,
  movementType: 'ADJUSTMENT',
  amountSigned: 100,
  currency: 'COP',
  occurredAt: new Date('2026-08-27T10:00:00Z'),
  description: 'Saldo inicial',
  referenceType: 'OPENING_BALANCE',
  referenceId: account.id,
  reversalOfId: null,
  ...overrides,
});

const closure = (overrides: Partial<CashClosure> = {}): CashClosure => ({
  id: 'closure-1',
  accountId: account.id,
  expectedBalance: 90,
  countedBalance: 90,
  variance: 0,
  occurredAt: new Date('2026-08-27T12:00:00Z'),
  notes: null,
  ...overrides,
});

describe('finance ledger integrity', () => {
  it('passes when reported balance equals the complete ledger', () => {
    const result = evaluateFinanceLedgerIntegrity({
      accounts: [account],
      movements: [movement(), movement({ id: 'expense', movementType: 'EXPENSE', amountSigned: -10 })],
      closures: [closure()],
    });
    expect(result.status).toBe('PASS');
    expect(result.accountChecks[0]?.delta).toBe(0);
  });

  it('blocks when the account balance differs from the ledger sum', () => {
    const result = evaluateFinanceLedgerIntegrity({
      accounts: [{ ...account, balance: 95 }],
      movements: [movement(), movement({ id: 'expense', movementType: 'EXPENSE', amountSigned: -10 })],
      closures: [],
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'ACCOUNT_BALANCE_MISMATCH')).toBe(true);
  });

  it('validates a closure against ledger history up to the closure time', () => {
    const laterMovement = movement({
      id: 'later',
      movementType: 'EXPENSE',
      amountSigned: -20,
      occurredAt: new Date('2026-08-27T13:00:00Z'),
    });
    const result = evaluateFinanceLedgerIntegrity({
      accounts: [{ ...account, balance: 70 }],
      movements: [movement(), movement({ id: 'expense', movementType: 'EXPENSE', amountSigned: -10 }), laterMovement],
      closures: [closure()],
    });
    expect(result.status).toBe('PASS');
  });

  it('blocks a closure whose expected balance does not match ledger chronology', () => {
    const result = evaluateFinanceLedgerIntegrity({
      accounts: [account],
      movements: [movement(), movement({ id: 'expense', movementType: 'EXPENSE', amountSigned: -10 })],
      closures: [closure({ expectedBalance: 80, countedBalance: 80 })],
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.issues.some((issue) => issue.code === 'CLOSURE_EXPECTED_BALANCE_MISMATCH')).toBe(true);
  });

  it('marks a counted cash variance for review without changing ledger truth', () => {
    const result = evaluateFinanceLedgerIntegrity({
      accounts: [account],
      movements: [movement(), movement({ id: 'expense', movementType: 'EXPENSE', amountSigned: -10 })],
      closures: [closure({ countedBalance: 85, variance: -5 })],
    });
    expect(result.status).toBe('REVIEW');
    expect(result.issues.some((issue) => issue.code === 'CLOSURE_VARIANCE')).toBe(true);
  });
});
