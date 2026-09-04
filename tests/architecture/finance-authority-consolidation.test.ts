import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('GAP-030 finance authority consolidation architecture', () => {
  const authority = read('packages/finance/src/domain/finance-authority.ts');
  const repository = read('packages/finance/src/infrastructure/supabase-finance-repository.ts');
  const port = read('packages/finance/src/ports/finance-repository.ts');
  const index = read('packages/finance/src/index.ts');

  it('exports the finance authority contract from the Finance package', () => {
    expect(index).toContain("export * from './domain/finance-authority';");
  });

  it('defines public.financial_movements as the single canonical operational ledger', () => {
    expect(authority).toContain(
      "export const canonicalFinanceOperationalLedger = 'public.financial_movements'",
    );
    expect(authority).toContain('thirdLedgerAllowed: false');
    expect(authority).toContain('FINANCE_OPERATIONAL_AUTHORITY_MUST_BE_SINGLE');
  });

  it('classifies the private historical ledger as legacy evidence, never operational authority', () => {
    expect(authority).toContain(
      "export const legacyFinanceEvidenceLedger = 'lihen_private.financial_ledger_entries'",
    );
    expect(authority).toContain("role: 'LEGACY_EVIDENCE_LEDGER'");
    expect(authority).toContain('historicalEvidenceOnly: true');
    expect(authority).toContain('legacyEvidenceMayBecomeOperationalAuthority: false');
  });

  it('keeps Finance repository reads on the public operational ledger and derived balance view', () => {
    expect(repository).toContain(".from('financial_movements')");
    expect(repository).toContain(".from('financial_account_balances')");
    expect(repository).not.toContain("from('financial_ledger_entries')");
    expect(repository).not.toContain("from('legacy_financial_account_snapshots')");
    expect(port).toContain('listLedgerMovements()');
  });

  it('keeps application writes mediated by the existing controlled Finance RPC boundary', () => {
    for (const rpc of [
      'create_financial_account_controlled',
      'record_expense_controlled',
      'transfer_financial_funds_controlled',
      'reverse_financial_movement_controlled',
      'record_cash_closure_controlled',
    ]) {
      expect(repository).toContain(`rpc('${rpc}'`);
    }

    expect(repository).toContain("throw new Error('FINANCE_WRITE_BLOCKED')");
    expect(repository).not.toContain(".from('financial_movements').insert");
    expect(repository).not.toContain(".from('financial_accounts').insert");
    expect(repository).not.toContain(".from('cash_closures').insert");
  });

  it('does not introduce Supabase, SQL, React, or a new persistence adapter in the authority domain', () => {
    expect(authority).not.toMatch(/@supabase|Supabase|\.from\(|\.rpc\(|insert\s+into|update\s+|delete\s+from/i);
    expect(authority).not.toMatch(/react|jsx|tsx/i);
  });

  it('does not make the write-operation journal a financial movement ledger', () => {
    expect(authority).toContain(
      "export const financeWriteOperationJournal = 'lihen_private.financial_write_operations'",
    );
    expect(authority).toContain("role: 'CONTROLLED_WRITE_JOURNAL'");
  });
});
