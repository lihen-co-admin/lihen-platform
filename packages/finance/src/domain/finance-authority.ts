/**
 * GAP-030 — Finance Authority Consolidation
 *
 * This module does not create a ledger. It makes the already-existing finance
 * authority explicit so application code can distinguish:
 * - the canonical operational movement ledger,
 * - derived/read projections,
 * - controlled-write audit/idempotency state,
 * - historical legacy evidence.
 *
 * No persistence dependency is imported here.
 */

export const canonicalFinanceOperationalLedger = 'public.financial_movements' as const;
export const canonicalFinanceBalanceProjection = 'public.financial_account_balances' as const;
export const canonicalFinanceAccountRegistry = 'public.financial_accounts' as const;
export const canonicalFinanceCashClosureRegister = 'public.cash_closures' as const;
export const financeWriteOperationJournal = 'lihen_private.financial_write_operations' as const;
export const legacyFinanceEvidenceLedger = 'lihen_private.financial_ledger_entries' as const;
export const legacyFinanceAccountSnapshots = 'lihen_private.legacy_financial_account_snapshots' as const;

export const controlledFinanceWriteFunctions = [
  'public.create_financial_account_controlled',
  'public.record_expense_controlled',
  'public.transfer_financial_funds_controlled',
  'public.reverse_financial_movement_controlled',
  'public.record_cash_closure_controlled',
] as const;

export type FinancePersistenceRelation =
  | typeof canonicalFinanceOperationalLedger
  | typeof canonicalFinanceBalanceProjection
  | typeof canonicalFinanceAccountRegistry
  | typeof canonicalFinanceCashClosureRegister
  | typeof financeWriteOperationJournal
  | typeof legacyFinanceEvidenceLedger
  | typeof legacyFinanceAccountSnapshots;

export type FinanceAuthorityRole =
  | 'CANONICAL_OPERATIONAL_LEDGER'
  | 'DERIVED_BALANCE_PROJECTION'
  | 'ACCOUNT_REGISTRY'
  | 'CASH_CLOSURE_REGISTER'
  | 'CONTROLLED_WRITE_JOURNAL'
  | 'LEGACY_EVIDENCE_LEDGER'
  | 'LEGACY_ACCOUNT_SNAPSHOT';

export interface FinanceAuthorityRelationDefinition {
  readonly relation: FinancePersistenceRelation;
  readonly role: FinanceAuthorityRole;
  /**
   * "Operational authority" means the relation may define current financial
   * movement truth. Exactly one relation must have this flag.
   */
  readonly operationalAuthority: boolean;
  /**
   * Application code must never perform direct writes to any of these
   * relations. Mutations are mediated by controlled Finance RPCs.
   */
  readonly directApplicationWriteAllowed: false;
  /**
   * Legacy evidence is preserved for traceability/migration verification and
   * must not be promoted back into current operational authority.
   */
  readonly historicalEvidenceOnly: boolean;
}

export const financeAuthorityRelations: readonly FinanceAuthorityRelationDefinition[] = [
  {
    relation: canonicalFinanceOperationalLedger,
    role: 'CANONICAL_OPERATIONAL_LEDGER',
    operationalAuthority: true,
    directApplicationWriteAllowed: false,
    historicalEvidenceOnly: false,
  },
  {
    relation: canonicalFinanceBalanceProjection,
    role: 'DERIVED_BALANCE_PROJECTION',
    operationalAuthority: false,
    directApplicationWriteAllowed: false,
    historicalEvidenceOnly: false,
  },
  {
    relation: canonicalFinanceAccountRegistry,
    role: 'ACCOUNT_REGISTRY',
    operationalAuthority: false,
    directApplicationWriteAllowed: false,
    historicalEvidenceOnly: false,
  },
  {
    relation: canonicalFinanceCashClosureRegister,
    role: 'CASH_CLOSURE_REGISTER',
    operationalAuthority: false,
    directApplicationWriteAllowed: false,
    historicalEvidenceOnly: false,
  },
  {
    relation: financeWriteOperationJournal,
    role: 'CONTROLLED_WRITE_JOURNAL',
    operationalAuthority: false,
    directApplicationWriteAllowed: false,
    historicalEvidenceOnly: false,
  },
  {
    relation: legacyFinanceEvidenceLedger,
    role: 'LEGACY_EVIDENCE_LEDGER',
    operationalAuthority: false,
    directApplicationWriteAllowed: false,
    historicalEvidenceOnly: true,
  },
  {
    relation: legacyFinanceAccountSnapshots,
    role: 'LEGACY_ACCOUNT_SNAPSHOT',
    operationalAuthority: false,
    directApplicationWriteAllowed: false,
    historicalEvidenceOnly: true,
  },
] as const;

export interface FinanceAuthorityModel {
  readonly operationalLedger: typeof canonicalFinanceOperationalLedger;
  readonly balanceProjection: typeof canonicalFinanceBalanceProjection;
  readonly accountRegistry: typeof canonicalFinanceAccountRegistry;
  readonly cashClosureRegister: typeof canonicalFinanceCashClosureRegister;
  readonly writeOperationJournal: typeof financeWriteOperationJournal;
  readonly legacyEvidenceLedger: typeof legacyFinanceEvidenceLedger;
  readonly legacyAccountSnapshots: typeof legacyFinanceAccountSnapshots;
  readonly controlledWriteFunctions: typeof controlledFinanceWriteFunctions;
  readonly relations: readonly FinanceAuthorityRelationDefinition[];
  readonly thirdLedgerAllowed: false;
  readonly legacyEvidenceMayBecomeOperationalAuthority: false;
  readonly directApplicationLedgerWritesAllowed: false;
}

export const financeAuthorityModel: FinanceAuthorityModel = Object.freeze({
  operationalLedger: canonicalFinanceOperationalLedger,
  balanceProjection: canonicalFinanceBalanceProjection,
  accountRegistry: canonicalFinanceAccountRegistry,
  cashClosureRegister: canonicalFinanceCashClosureRegister,
  writeOperationJournal: financeWriteOperationJournal,
  legacyEvidenceLedger: legacyFinanceEvidenceLedger,
  legacyAccountSnapshots: legacyFinanceAccountSnapshots,
  controlledWriteFunctions: controlledFinanceWriteFunctions,
  relations: financeAuthorityRelations,
  thirdLedgerAllowed: false,
  legacyEvidenceMayBecomeOperationalAuthority: false,
  directApplicationLedgerWritesAllowed: false,
});

export function getFinanceAuthorityRelation(
  relation: FinancePersistenceRelation,
): FinanceAuthorityRelationDefinition {
  const definition = financeAuthorityRelations.find((candidate) => candidate.relation === relation);
  if (!definition) {
    // The union makes this unreachable for typed callers, but retaining an
    // explicit guard keeps runtime consumers deterministic.
    throw new Error(`UNKNOWN_FINANCE_RELATION:${String(relation)}`);
  }
  return definition;
}

export interface FinanceAuthorityValidationResult {
  readonly status: 'PASS' | 'BLOCKED';
  readonly issues: readonly string[];
  readonly operationalAuthorityCount: number;
}

/**
 * Pure structural guard used by tests/diagnostics. It prevents accidental
 * promotion of a second/third operational ledger without touching storage.
 */
export function validateFinanceAuthorityModel(
  relations: readonly FinanceAuthorityRelationDefinition[] = financeAuthorityRelations,
): FinanceAuthorityValidationResult {
  const issues: string[] = [];
  const operationalAuthorities = relations.filter((relation) => relation.operationalAuthority);

  if (operationalAuthorities.length !== 1) {
    issues.push('FINANCE_OPERATIONAL_AUTHORITY_MUST_BE_SINGLE');
  } else if (operationalAuthorities[0]?.relation !== canonicalFinanceOperationalLedger) {
    issues.push('FINANCE_OPERATIONAL_AUTHORITY_MUST_BE_PUBLIC_FINANCIAL_MOVEMENTS');
  }

  const legacyPromoted = relations.some(
    (relation) => relation.historicalEvidenceOnly && relation.operationalAuthority,
  );
  if (legacyPromoted) {
    issues.push('LEGACY_FINANCE_EVIDENCE_CANNOT_BE_OPERATIONAL_AUTHORITY');
  }

  const directWriteEnabled = relations.some((relation) => relation.directApplicationWriteAllowed);
  if (directWriteEnabled) {
    issues.push('DIRECT_APPLICATION_FINANCE_WRITE_NOT_ALLOWED');
  }

  return {
    status: issues.length === 0 ? 'PASS' : 'BLOCKED',
    issues,
    operationalAuthorityCount: operationalAuthorities.length,
  };
}
