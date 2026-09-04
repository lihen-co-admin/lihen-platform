import { describe, expect, it } from 'vitest';
import {
  canonicalFinanceOperationalLedger,
  financeAuthorityModel,
  financeAuthorityRelations,
  getFinanceAuthorityRelation,
  legacyFinanceEvidenceLedger,
  validateFinanceAuthorityModel,
  type FinanceAuthorityRelationDefinition,
} from '../src';

describe('finance authority consolidation', () => {
  it('declares exactly one canonical operational movement ledger', () => {
    const result = validateFinanceAuthorityModel();

    expect(result).toEqual({
      status: 'PASS',
      issues: [],
      operationalAuthorityCount: 1,
    });
    expect(financeAuthorityModel.operationalLedger).toBe('public.financial_movements');
  });

  it('keeps the legacy financial ledger as historical evidence only', () => {
    const legacy = getFinanceAuthorityRelation(legacyFinanceEvidenceLedger);

    expect(legacy.role).toBe('LEGACY_EVIDENCE_LEDGER');
    expect(legacy.historicalEvidenceOnly).toBe(true);
    expect(legacy.operationalAuthority).toBe(false);
    expect(legacy.directApplicationWriteAllowed).toBe(false);
  });

  it('keeps the balance projection derived from operational truth rather than a ledger authority', () => {
    const balance = getFinanceAuthorityRelation('public.financial_account_balances');

    expect(balance.role).toBe('DERIVED_BALANCE_PROJECTION');
    expect(balance.operationalAuthority).toBe(false);
    expect(balance.directApplicationWriteAllowed).toBe(false);
  });

  it('requires all application mutations to remain outside direct relation writes', () => {
    expect(financeAuthorityRelations.every((relation) => !relation.directApplicationWriteAllowed)).toBe(true);
    expect(financeAuthorityModel.directApplicationLedgerWritesAllowed).toBe(false);
    expect(financeAuthorityModel.controlledWriteFunctions).toEqual([
      'public.create_financial_account_controlled',
      'public.record_expense_controlled',
      'public.transfer_financial_funds_controlled',
      'public.reverse_financial_movement_controlled',
      'public.record_cash_closure_controlled',
    ]);
  });

  it('explicitly forbids a third operational ledger', () => {
    expect(financeAuthorityModel.thirdLedgerAllowed).toBe(false);
    expect(financeAuthorityModel.legacyEvidenceMayBecomeOperationalAuthority).toBe(false);
  });

  it('blocks a model with more than one operational authority', () => {
    const duplicateAuthority: FinanceAuthorityRelationDefinition = {
      relation: 'lihen_private.financial_ledger_entries',
      role: 'LEGACY_EVIDENCE_LEDGER',
      operationalAuthority: true,
      directApplicationWriteAllowed: false,
      historicalEvidenceOnly: true,
    };

    const result = validateFinanceAuthorityModel([
      ...financeAuthorityRelations.filter((item) => item.relation !== duplicateAuthority.relation),
      duplicateAuthority,
    ]);

    expect(result.status).toBe('BLOCKED');
    expect(result.operationalAuthorityCount).toBe(2);
    expect(result.issues).toContain('FINANCE_OPERATIONAL_AUTHORITY_MUST_BE_SINGLE');
    expect(result.issues).toContain('LEGACY_FINANCE_EVIDENCE_CANNOT_BE_OPERATIONAL_AUTHORITY');
  });

  it('blocks replacing the canonical ledger with legacy evidence', () => {
    const replacement: FinanceAuthorityRelationDefinition = {
      relation: legacyFinanceEvidenceLedger,
      role: 'LEGACY_EVIDENCE_LEDGER',
      operationalAuthority: true,
      directApplicationWriteAllowed: false,
      historicalEvidenceOnly: true,
    };

    const result = validateFinanceAuthorityModel([replacement]);

    expect(result.status).toBe('BLOCKED');
    expect(result.issues).toContain(
      'FINANCE_OPERATIONAL_AUTHORITY_MUST_BE_PUBLIC_FINANCIAL_MOVEMENTS',
    );
    expect(result.issues).toContain('LEGACY_FINANCE_EVIDENCE_CANNOT_BE_OPERATIONAL_AUTHORITY');
  });

  it('identifies the canonical relation deterministically', () => {
    const relation = getFinanceAuthorityRelation(canonicalFinanceOperationalLedger);

    expect(relation.role).toBe('CANONICAL_OPERATIONAL_LEDGER');
    expect(relation.operationalAuthority).toBe(true);
    expect(relation.historicalEvidenceOnly).toBe(false);
  });
});
