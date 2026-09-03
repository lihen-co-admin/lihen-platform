import type {
  Confidence,
  CorrelationId,
  IntelligenceCandidate,
  IntelligenceContext,
  IntelligenceEvidence,
  IntelligenceRecommendation,
} from '../contracts';
import type { ProductReconciliationClassification } from './product-reconciliation';

/**
 * WAVE 6 / GAP-021 — Supplier Price Evidence.
 *
 * Pure evidence/read-model policy over Supplier Source Records + Product Reconciliation.
 * Supplier observations are evidence only. This capability does not persist pricing,
 * update supplier relations, write cost history, change sale price, or execute commands.
 */

export type SupplierPriceEvidenceKind = 'UNIT_COST' | 'SUGGESTED_SALE_PRICE';

export interface SupplierPriceReconciliationRef {
  readonly classification: ProductReconciliationClassification;
  /** Observed Product Master proposal from GAP-020. Never mutation authorization. */
  readonly proposedProductId: string | null;
}

export interface SupplierPriceObservation {
  readonly sourceRecordId: string;
  readonly documentId: string;
  readonly supplierId: string | null;
  readonly observedAt: string;
  readonly unitCost: number | null;
  readonly suggestedSalePrice: number | null;
  readonly extractionConfidence: number | null;
  readonly sourceEvidenceIds: readonly string[];
}

export interface SupplierPriceBaseline {
  readonly currency: 'COP';
  /** Operational/current Product cost reference. Not supplier-document evidence. */
  readonly currentCost: number | null;
  /** Current commercial sale price. Canonical mutation belongs to Pricing Domain. */
  readonly currentSalePrice: number | null;
  /** Existing supplier-product last confirmed cost, when available. */
  readonly supplierLastCost: number | null;
  /** Previous observation from an earlier source document for the same supplier/product candidate. */
  readonly previousObservedUnitCost: number | null;
}

export interface PrepareSupplierPriceEvidenceInput {
  readonly correlationId: CorrelationId;
  readonly context: IntelligenceContext;
  readonly observation: SupplierPriceObservation;
  readonly reconciliation: SupplierPriceReconciliationRef;
  readonly baseline: SupplierPriceBaseline;
  readonly createdAt: string;
}

export interface PreparedSupplierPriceEvidence {
  readonly evidence: readonly IntelligenceEvidence[];
  readonly candidate: IntelligenceCandidate | null;
  readonly recommendation: IntelligenceRecommendation | null;
  /** Only an EXACT_MATCH may expose a canonical Product Master reference. */
  readonly canonicalProductId: string | null;
  /** Fuzzy/possible matches remain candidate references only. */
  readonly candidateProductId: string | null;
  readonly costReferenceAmount: number | null;
  readonly unitCostDelta: number | null;
  readonly suggestedSalePriceDelta: number | null;
  readonly requiresHumanReview: boolean;
  readonly canAutoUpdateSalePrice: false;
  readonly canAutoWriteCostHistory: false;
  readonly canAutoUpdateSupplierLastCost: false;
}

function requiredText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function nullableNonNegative(value: number | null, code: string): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
  return value;
}

function validateConfidence(value: number | null): number {
  if (value === null) return 0.5;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('SUPPLIER_PRICE_EVIDENCE_CONFIDENCE_INVALID');
  }
  return value;
}

function confidenceFrom(score: number, rationale: readonly string[]): Confidence {
  const band: Confidence['band'] =
    score >= 0.9
      ? 'VERY_HIGH'
      : score >= 0.75
        ? 'HIGH'
        : score >= 0.5
          ? 'MEDIUM'
          : score >= 0.25
            ? 'LOW'
            : 'VERY_LOW';
  return {
    score,
    band,
    rationale: [...rationale, 'Confidence is evidence quality, never pricing authorization.'],
  };
}

function stableFingerprint(parts: readonly string[]): string {
  let hash = 2166136261;
  const value = parts.join('|');
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `gap021-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function distinctEvidenceIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids.map((id) => requiredText(id, 'SUPPLIER_PRICE_EVIDENCE_ID_REQUIRED')))];
}

function canonicalProductIdFor(ref: SupplierPriceReconciliationRef): string | null {
  if (ref.classification !== 'EXACT_MATCH') return null;
  return ref.proposedProductId
    ? requiredText(ref.proposedProductId, 'SUPPLIER_PRICE_PRODUCT_ID_REQUIRED')
    : null;
}

function candidateProductIdFor(ref: SupplierPriceReconciliationRef): string | null {
  if (ref.classification !== 'POSSIBLE_MATCH') return null;
  return ref.proposedProductId
    ? requiredText(ref.proposedProductId, 'SUPPLIER_PRICE_PRODUCT_ID_REQUIRED')
    : null;
}

function costReferenceFor(baseline: SupplierPriceBaseline): number | null {
  return baseline.previousObservedUnitCost ?? baseline.supplierLastCost ?? baseline.currentCost;
}

function delta(observed: number | null, reference: number | null): number | null {
  if (observed === null || reference === null) return null;
  return observed - reference;
}

function evidenceFor(input: {
  readonly evidenceId: string;
  readonly kind: SupplierPriceEvidenceKind;
  readonly amount: number;
  readonly correlationId: CorrelationId;
  readonly context: IntelligenceContext;
  readonly observation: SupplierPriceObservation;
  readonly canonicalProductId: string | null;
  readonly candidateProductId: string | null;
  readonly confidence: Confidence;
  readonly createdAt: string;
}): IntelligenceEvidence {
  const payload: Record<string, unknown> = {
    kind: input.kind,
    amount: input.amount,
    currency: 'COP',
    sourceRecordId: input.observation.sourceRecordId,
    documentId: input.observation.documentId,
    supplierId: input.observation.supplierId,
    canonicalProductId: input.canonicalProductId,
    candidateProductId: input.candidateProductId,
    supplierObservationOnly: true,
    canChangeSalePrice: false,
  };

  return {
    evidenceId: input.evidenceId,
    correlationId: input.correlationId,
    context: input.context,
    capability: 'PRODUCT_INTELLIGENCE',
    sourceAuthority: {
      level: 'SUPPLIER',
      sourceName: 'Supplier source document',
      rationale: [
        'The amount was observed in a supplier source record.',
        'Supplier pricing is evidence and not canonical commercial pricing authority.',
      ],
    },
    observation:
      input.kind === 'UNIT_COST'
        ? 'Supplier document contains an observed unit cost.'
        : 'Supplier document contains a suggested sale price.',
    payload,
    confidence: input.confidence,
    fingerprint: stableFingerprint([
      input.kind,
      input.observation.documentId,
      input.observation.sourceRecordId,
      String(input.amount),
      input.canonicalProductId ?? '',
      input.candidateProductId ?? '',
    ]),
    createdAt: input.createdAt,
  };
}

export function prepareSupplierPriceEvidence(
  input: PrepareSupplierPriceEvidenceInput,
): PreparedSupplierPriceEvidence {
  const correlationId = requiredText(
    input.correlationId,
    'SUPPLIER_PRICE_CORRELATION_ID_REQUIRED',
  );
  const sourceRecordId = requiredText(
    input.observation.sourceRecordId,
    'SUPPLIER_PRICE_SOURCE_RECORD_ID_REQUIRED',
  );
  const documentId = requiredText(
    input.observation.documentId,
    'SUPPLIER_PRICE_DOCUMENT_ID_REQUIRED',
  );
  const observedAt = requiredText(
    input.observation.observedAt,
    'SUPPLIER_PRICE_OBSERVED_AT_REQUIRED',
  );
  const createdAt = requiredText(input.createdAt, 'SUPPLIER_PRICE_CREATED_AT_REQUIRED');
  const supplierId = input.observation.supplierId?.trim() || null;

  const unitCost = nullableNonNegative(
    input.observation.unitCost,
    'SUPPLIER_PRICE_UNIT_COST_INVALID',
  );
  const suggestedSalePrice = nullableNonNegative(
    input.observation.suggestedSalePrice,
    'SUPPLIER_PRICE_SUGGESTED_SALE_PRICE_INVALID',
  );
  const baseline: SupplierPriceBaseline = {
    currency: input.baseline.currency,
    currentCost: nullableNonNegative(input.baseline.currentCost, 'SUPPLIER_PRICE_CURRENT_COST_INVALID'),
    currentSalePrice: nullableNonNegative(
      input.baseline.currentSalePrice,
      'SUPPLIER_PRICE_CURRENT_SALE_PRICE_INVALID',
    ),
    supplierLastCost: nullableNonNegative(
      input.baseline.supplierLastCost,
      'SUPPLIER_PRICE_SUPPLIER_LAST_COST_INVALID',
    ),
    previousObservedUnitCost: nullableNonNegative(
      input.baseline.previousObservedUnitCost,
      'SUPPLIER_PRICE_PREVIOUS_OBSERVED_COST_INVALID',
    ),
  };
  if (baseline.currency !== 'COP') {
    throw new Error('SUPPLIER_PRICE_CURRENCY_UNSUPPORTED');
  }

  const confidence = confidenceFrom(validateConfidence(input.observation.extractionConfidence), [
    'Confidence originates from supplier document extraction.',
  ]);
  const canonicalProductId = canonicalProductIdFor(input.reconciliation);
  const candidateProductId = candidateProductIdFor(input.reconciliation);
  const sourceEvidenceIds = distinctEvidenceIds(input.observation.sourceEvidenceIds);
  const evidence: IntelligenceEvidence[] = [];

  if (unitCost !== null) {
    evidence.push(
      evidenceFor({
        evidenceId: `${sourceRecordId}:UNIT_COST`,
        kind: 'UNIT_COST',
        amount: unitCost,
        correlationId,
        context: input.context,
        observation: {
          sourceRecordId,
          documentId,
          supplierId,
          observedAt,
          unitCost,
          suggestedSalePrice,
          extractionConfidence: input.observation.extractionConfidence,
          sourceEvidenceIds,
        },
        canonicalProductId,
        candidateProductId,
        confidence,
        createdAt,
      }),
    );
  }

  if (suggestedSalePrice !== null) {
    evidence.push(
      evidenceFor({
        evidenceId: `${sourceRecordId}:SUGGESTED_SALE_PRICE`,
        kind: 'SUGGESTED_SALE_PRICE',
        amount: suggestedSalePrice,
        correlationId,
        context: input.context,
        observation: {
          sourceRecordId,
          documentId,
          supplierId,
          observedAt,
          unitCost,
          suggestedSalePrice,
          extractionConfidence: input.observation.extractionConfidence,
          sourceEvidenceIds,
        },
        canonicalProductId,
        candidateProductId,
        confidence,
        createdAt,
      }),
    );
  }

  const costReferenceAmount = costReferenceFor(baseline);
  const unitCostDelta = delta(unitCost, costReferenceAmount);
  const suggestedSalePriceDelta = delta(suggestedSalePrice, baseline.currentSalePrice);
  const unresolvedIdentity = input.reconciliation.classification !== 'EXACT_MATCH';
  const costChanged = unitCostDelta !== null && unitCostDelta !== 0;
  const suggestedSalePriceChanged =
    suggestedSalePriceDelta !== null && suggestedSalePriceDelta !== 0;
  const hasUnanchoredSuggestion =
    suggestedSalePrice !== null && baseline.currentSalePrice === null;
  const requiresHumanReview =
    evidence.length > 0 &&
    (unresolvedIdentity || costChanged || suggestedSalePriceChanged || hasUnanchoredSuggestion);

  if (evidence.length === 0) {
    return {
      evidence: [],
      candidate: null,
      recommendation: null,
      canonicalProductId,
      candidateProductId,
      costReferenceAmount,
      unitCostDelta,
      suggestedSalePriceDelta,
      requiresHumanReview: false,
      canAutoUpdateSalePrice: false,
      canAutoWriteCostHistory: false,
      canAutoUpdateSupplierLastCost: false,
    };
  }

  const evidenceIds = distinctEvidenceIds([
    ...sourceEvidenceIds,
    ...evidence.map((entry) => entry.evidenceId),
  ]);
  const candidate: IntelligenceCandidate = {
    candidateId: `SUPPLIER_PRICE:${documentId}:${sourceRecordId}`,
    correlationId,
    type: 'PRICE_REVIEW',
    context: input.context,
    payload: {
      supplierId,
      documentId,
      sourceRecordId,
      observedAt,
      currency: baseline.currency,
      unitCost,
      suggestedSalePrice,
      canonicalProductId,
      candidateProductId,
      reconciliationClassification: input.reconciliation.classification,
      costReferenceAmount,
      unitCostDelta,
      suggestedSalePriceDelta,
      supplierSuggestedSalePriceIsNonAuthoritative: true,
      canAutoUpdateSalePrice: false,
      canAutoWriteCostHistory: false,
      canAutoUpdateSupplierLastCost: false,
    },
    evidenceIds,
    confidence,
    status: requiresHumanReview ? 'IN_REVIEW' : 'PENDING',
    createdAt,
  };

  const recommendation: IntelligenceRecommendation | null = requiresHumanReview
    ? {
        recommendationId: `SUPPLIER_PRICE_REVIEW:${documentId}:${sourceRecordId}`,
        correlationId,
        context: input.context,
        actionType: 'REVIEW_SUPPLIER_PRICE_EVIDENCE',
        title: 'Review supplier price evidence',
        explanation:
          'Supplier cost/pricing observations require governed review before any commercial or operational pricing action.',
        priority: costChanged || suggestedSalePriceChanged ? 'P1' : 'P2',
        severity: costChanged || suggestedSalePriceChanged ? 'WARNING' : 'INFO',
        source: 'SUPPLIER_DOCUMENT_PRICE_EVIDENCE',
        rationale: [
          unresolvedIdentity
            ? 'Product identity is not an exact reconciliation match.'
            : 'An exact Product Master proposal is available as evidence only.',
          costChanged
            ? 'Observed supplier unit cost differs from the best available comparison reference.'
            : 'No confirmed supplier unit-cost change was established against an available reference.',
          suggestedSalePriceChanged || hasUnanchoredSuggestion
            ? 'Supplier suggested sale price is non-authoritative and must not change LIHEN sale_price automatically.'
            : 'No supplier suggested sale-price difference requires escalation.',
          'Any future sale-price mutation must use Human Decision + Existing Control Plane + PRODUCT_PRICE_CHANGE.',
        ],
        evidenceIds,
        confidence,
        risk: {
          level: 'R2',
          reasons: [
            'This recommendation requests review only and does not authorize a canonical price mutation.',
            'A future sale-price change is a separate governed R3/controlled operation.',
          ],
          requiresHumanReview: true,
        },
        status: 'OPEN',
        createdAt,
      }
    : null;

  return {
    evidence,
    candidate,
    recommendation,
    canonicalProductId,
    candidateProductId,
    costReferenceAmount,
    unitCostDelta,
    suggestedSalePriceDelta,
    requiresHumanReview,
    canAutoUpdateSalePrice: false,
    canAutoWriteCostHistory: false,
    canAutoUpdateSupplierLastCost: false,
  };
}
