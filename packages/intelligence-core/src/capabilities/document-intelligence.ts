import type {
  Confidence,
  CorrelationId,
  IntelligenceContext,
  IntelligenceEvidence,
  IntelligenceRecommendation,
  SourceAuthority,
} from '../contracts';
import type { IntelligenceCapabilityHandler } from '../orchestrator';
import type {
  DocumentExtraction,
  DocumentExtractionPort,
  SearchPort,
  VisionPort,
} from '../provider-ports';

/**
 * WAVE 6 / GAP-019 — Document Intelligence Pipeline.
 *
 * Provider-neutral and persistence-neutral. It extracts and prepares evidence/source
 * records only. It does not reconcile Product Master, persist through RPC, or mutate
 * any canonical domain.
 */

export type DocumentIntelligenceBusinessLine = 'BEAUTY_CARE' | 'STYLE';

export type PreparedDocumentRecordStatus =
  | 'EXTRACTED'
  | 'REVIEW_REQUIRED'
  | 'REJECTED';

export interface DocumentIntelligenceTools {
  readonly document: DocumentExtractionPort;
  readonly vision?: VisionPort;
  readonly search?: SearchPort;
}

export interface DocumentIntelligenceRecord {
  readonly sourceRowKey: string;
  readonly sourcePage: number | null;
  readonly sourceSlot: string | null;
  readonly rawText: string | null;
  readonly supplierReference: string | null;
  readonly productName: string | null;
  readonly brandText: string | null;
  readonly categoryText: string | null;
  readonly subcategoryText: string | null;
  readonly businessLine: DocumentIntelligenceBusinessLine | null;
  readonly unitCost: number | null;
  readonly suggestedSalePrice: number | null;
  readonly quantityHint: number | null;
  readonly imageReference: string | null;
  readonly extractionConfidence: number | null;
}

export interface PreparedSupplierSourceRecord {
  readonly documentId: string;
  readonly sourceRowKey: string;
  readonly sourcePage: number | null;
  readonly sourceSlot: string | null;
  readonly rawText: string | null;
  readonly supplierReference: string | null;
  readonly productName: string | null;
  readonly brandText: string | null;
  readonly categoryText: string | null;
  readonly subcategoryText: string | null;
  readonly businessLine: DocumentIntelligenceBusinessLine | null;
  readonly unitCost: number | null;
  readonly suggestedSalePrice: number | null;
  readonly quantityHint: number | null;
  readonly imageReference: string | null;
  readonly extractionConfidence: number | null;
  readonly extractionStatus: PreparedDocumentRecordStatus;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface DocumentIntelligenceExecutionConfig {
  readonly documentId: string;
  readonly sourceName: string;
  readonly sourceUri?: string;
  readonly extractionSchemaVersion: string;
  readonly reviewConfidenceThreshold?: number;
}

export interface DocumentIntelligenceExecutionResult {
  readonly documentEvidence: IntelligenceEvidence;
  readonly recordEvidence: readonly IntelligenceEvidence[];
  readonly preparedRecords: readonly PreparedSupplierSourceRecord[];
  readonly recommendation?: IntelligenceRecommendation;
  readonly providerWarnings: readonly string[];
}

const DEFAULT_REVIEW_THRESHOLD = 0.75;

const SUPPLIER_RECORD_EXTRACTION_SCHEMA = Object.freeze({
  type: 'object',
  required: ['records'],
  properties: {
    records: {
      type: 'array',
      items: {
        type: 'object',
        required: ['sourceRowKey'],
        properties: {
          sourceRowKey: { type: 'string' },
          sourcePage: { type: ['integer', 'null'] },
          sourceSlot: { type: ['string', 'null'] },
          rawText: { type: ['string', 'null'] },
          supplierReference: { type: ['string', 'null'] },
          productName: { type: ['string', 'null'] },
          brandText: { type: ['string', 'null'] },
          categoryText: { type: ['string', 'null'] },
          subcategoryText: { type: ['string', 'null'] },
          businessLine: {
            type: ['string', 'null'],
            enum: ['BEAUTY_CARE', 'STYLE', null],
          },
          unitCost: { type: ['number', 'null'], minimum: 0 },
          suggestedSalePrice: { type: ['number', 'null'], minimum: 0 },
          quantityHint: { type: ['integer', 'null'], minimum: 0 },
          imageReference: { type: ['string', 'null'] },
          extractionConfidence: {
            type: ['number', 'null'],
            minimum: 0,
            maximum: 1,
          },
        },
      },
    },
  },
}) satisfies Readonly<Record<string, unknown>>;

function requiredText(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function nullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function nullableNonNegativeNumber(
  value: unknown,
  code: string,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(code);
  }
  return value;
}

function nullableInteger(value: unknown, code: string): number | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value)
  ) {
    throw new Error(code);
  }
  return value;
}

function confidenceFrom(score: number | null): Confidence {
  const normalized = score ?? 0;
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    throw new Error('DOCUMENT_INTELLIGENCE_CONFIDENCE_INVALID');
  }
  const band: Confidence['band'] =
    normalized >= 0.9
      ? 'VERY_HIGH'
      : normalized >= 0.75
        ? 'HIGH'
        : normalized >= 0.5
          ? 'MEDIUM'
          : normalized >= 0.25
            ? 'LOW'
            : 'VERY_LOW';
  return {
    score: normalized,
    band,
    rationale: [
      `Normalized Document Intelligence confidence: ${normalized.toFixed(2)}.`,
      'Confidence is evidence quality, not authorization.',
    ],
  };
}

function normalizeBusinessLine(
  value: unknown,
): DocumentIntelligenceBusinessLine | null {
  if (value === null || value === undefined || value === '') return null;
  if (value === 'BEAUTY_CARE' || value === 'STYLE') return value;
  throw new Error('DOCUMENT_INTELLIGENCE_BUSINESS_LINE_INVALID');
}

function normalizeRecord(value: unknown): DocumentIntelligenceRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('DOCUMENT_INTELLIGENCE_RECORD_INVALID');
  }
  const record = value as Record<string, unknown>;
  const sourceRowKey = requiredText(
    typeof record.sourceRowKey === 'string' ? record.sourceRowKey : '',
    'DOCUMENT_INTELLIGENCE_SOURCE_ROW_KEY_REQUIRED',
  );
  const sourcePage = nullableInteger(
    record.sourcePage,
    'DOCUMENT_INTELLIGENCE_SOURCE_PAGE_INVALID',
  );
  if (sourcePage !== null && sourcePage < 0) {
    throw new Error('DOCUMENT_INTELLIGENCE_SOURCE_PAGE_INVALID');
  }
  const quantityHint = nullableInteger(
    record.quantityHint,
    'DOCUMENT_INTELLIGENCE_QUANTITY_INVALID',
  );
  if (quantityHint !== null && quantityHint < 0) {
    throw new Error('DOCUMENT_INTELLIGENCE_QUANTITY_INVALID');
  }
  const extractionConfidence = nullableNonNegativeNumber(
    record.extractionConfidence,
    'DOCUMENT_INTELLIGENCE_CONFIDENCE_INVALID',
  );
  if (extractionConfidence !== null && extractionConfidence > 1) {
    throw new Error('DOCUMENT_INTELLIGENCE_CONFIDENCE_INVALID');
  }

  return {
    sourceRowKey,
    sourcePage,
    sourceSlot: nullableText(record.sourceSlot),
    rawText: nullableText(record.rawText),
    supplierReference: nullableText(record.supplierReference),
    productName: nullableText(record.productName),
    brandText: nullableText(record.brandText),
    categoryText: nullableText(record.categoryText),
    subcategoryText: nullableText(record.subcategoryText),
    businessLine: normalizeBusinessLine(record.businessLine),
    unitCost: nullableNonNegativeNumber(
      record.unitCost,
      'DOCUMENT_INTELLIGENCE_UNIT_COST_INVALID',
    ),
    suggestedSalePrice: nullableNonNegativeNumber(
      record.suggestedSalePrice,
      'DOCUMENT_INTELLIGENCE_SUGGESTED_SALE_PRICE_INVALID',
    ),
    quantityHint,
    imageReference: nullableText(record.imageReference),
    extractionConfidence,
  };
}

function recordsFromExtraction(
  extraction: DocumentExtraction,
): readonly DocumentIntelligenceRecord[] {
  const rawRecords = extraction.fields.records;
  if (!Array.isArray(rawRecords)) {
    throw new Error('DOCUMENT_INTELLIGENCE_RECORDS_ARRAY_REQUIRED');
  }
  const records = rawRecords.map(normalizeRecord);
  const rowKeys = new Set<string>();
  for (const record of records) {
    if (rowKeys.has(record.sourceRowKey)) {
      throw new Error('DOCUMENT_INTELLIGENCE_SOURCE_ROW_KEY_DUPLICATE');
    }
    rowKeys.add(record.sourceRowKey);
  }
  return records;
}

function stableFingerprint(parts: readonly string[]): string {
  return parts
    .map((part) => part.trim())
    .join('|')
    .toLowerCase();
}

function recordStatus(
  record: DocumentIntelligenceRecord,
  threshold: number,
): PreparedDocumentRecordStatus {
  if (!record.productName) return 'REVIEW_REQUIRED';
  if (
    record.extractionConfidence === null ||
    record.extractionConfidence < threshold
  ) {
    return 'REVIEW_REQUIRED';
  }
  return 'EXTRACTED';
}

function supplierSourceAuthority(
  sourceName: string,
  sourceUri?: string,
): SourceAuthority {
  return {
    level: 'SUPPLIER',
    sourceName,
    ...(sourceUri ? { sourceUri } : {}),
    rationale: [
      'The document is supplier-origin evidence.',
      'Supplier evidence does not become canonical Product/Pricing authority.',
    ],
  };
}

function reviewRecommendation(input: {
  readonly correlationId: CorrelationId;
  readonly context: IntelligenceContext;
  readonly evidenceIds: readonly string[];
  readonly createdAt: string;
  readonly confidence: Confidence;
  readonly reasons: readonly string[];
}): IntelligenceRecommendation {
  return {
    recommendationId: `document-review:${input.correlationId}`,
    correlationId: input.correlationId,
    context: input.context,
    actionType: 'REVIEW_DOCUMENT_EXTRACTION',
    title: 'Review supplier document extraction',
    explanation:
      'Document Intelligence produced extraction evidence that requires human review before downstream reconciliation or controlled ingestion decisions.',
    priority: 'P2',
    severity: 'WARNING',
    source: 'DOCUMENT_INTELLIGENCE',
    rationale: [...input.reasons, 'No canonical mutation is authorized.'],
    evidenceIds: input.evidenceIds,
    confidence: input.confidence,
    risk: {
      level: 'R2',
      reasons: [
        'Extraction evidence may contain ambiguity or incomplete product identity.',
        'Review precedes downstream reconciliation and governed mutation.',
      ],
      requiresHumanReview: true,
    },
    status: 'OPEN',
    createdAt: input.createdAt,
  };
}

export async function executeDocumentIntelligence(
  tools: DocumentIntelligenceTools,
  input: {
    readonly correlationId: CorrelationId;
    readonly requestedBy: string;
    readonly context: IntelligenceContext;
    readonly config: DocumentIntelligenceExecutionConfig;
    readonly createdAt: string;
  },
): Promise<DocumentIntelligenceExecutionResult> {
  const correlationId = requiredText(
    input.correlationId,
    'DOCUMENT_INTELLIGENCE_CORRELATION_ID_REQUIRED',
  );
  const documentId = requiredText(
    input.config.documentId,
    'DOCUMENT_INTELLIGENCE_DOCUMENT_ID_REQUIRED',
  );
  const sourceName = requiredText(
    input.config.sourceName,
    'DOCUMENT_INTELLIGENCE_SOURCE_NAME_REQUIRED',
  );
  const schemaVersion = requiredText(
    input.config.extractionSchemaVersion,
    'DOCUMENT_INTELLIGENCE_SCHEMA_VERSION_REQUIRED',
  );
  const createdAt = requiredText(
    input.createdAt,
    'DOCUMENT_INTELLIGENCE_CREATED_AT_REQUIRED',
  );

  if (input.context.type !== 'DOCUMENT' && input.context.type !== 'SUPPLIER') {
    throw new Error('DOCUMENT_INTELLIGENCE_CONTEXT_INVALID');
  }

  const threshold =
    input.config.reviewConfidenceThreshold ?? DEFAULT_REVIEW_THRESHOLD;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error('DOCUMENT_INTELLIGENCE_REVIEW_THRESHOLD_INVALID');
  }

  const providerResult = await tools.document.extract({
    correlationId,
    requestedBy: input.requestedBy,
    context: input.context,
    document: {
      documentRef: documentId,
      ...(input.config.sourceUri
        ? { sourceUri: input.config.sourceUri }
        : {}),
    },
    extractionSchema: {
      ...SUPPLIER_RECORD_EXTRACTION_SCHEMA,
      schemaVersion,
    },
  });

  if (
    providerResult.status === 'FAILED' ||
    providerResult.status === 'UNAVAILABLE' ||
    providerResult.status === 'RATE_LIMITED' ||
    !providerResult.data
  ) {
    throw new Error(
      `DOCUMENT_INTELLIGENCE_PROVIDER_${providerResult.status}`,
    );
  }

  const sourceAuthority = supplierSourceAuthority(
    sourceName,
    input.config.sourceUri,
  );
  const records = recordsFromExtraction(providerResult.data);

  const documentConfidenceScore =
    records.length === 0
      ? 0
      : records.reduce(
          (sum, record) => sum + (record.extractionConfidence ?? 0),
          0,
        ) / records.length;
  const documentConfidence = confidenceFrom(documentConfidenceScore);

  const documentEvidenceId = `document:${documentId}:extraction`;
  const documentEvidence: IntelligenceEvidence = {
    evidenceId: documentEvidenceId,
    correlationId,
    context: input.context,
    capability: 'DOCUMENT_INTELLIGENCE',
    sourceAuthority,
    observation: `Structured supplier document extraction produced ${records.length} record(s).`,
    payload: {
      documentId,
      pages: providerResult.data.pages,
      providerStatus: providerResult.status,
      warningCount: providerResult.data.warnings.length,
      schemaVersion,
    },
    confidence: documentConfidence,
    fingerprint: stableFingerprint([
      documentId,
      schemaVersion,
      String(records.length),
      ...providerResult.data.pages.map(String),
    ]),
    createdAt,
  };

  const recordEvidence: IntelligenceEvidence[] = [];
  const preparedRecords: PreparedSupplierSourceRecord[] = [];

  for (const record of records) {
    const status = recordStatus(record, threshold);
    const evidenceId = `document:${documentId}:record:${record.sourceRowKey}`;
    const confidence = confidenceFrom(record.extractionConfidence);
    const fingerprint = stableFingerprint([
      documentId,
      record.sourceRowKey,
      record.productName ?? '',
      record.supplierReference ?? '',
      String(record.sourcePage ?? ''),
      String(record.extractionConfidence ?? ''),
    ]);

    recordEvidence.push({
      evidenceId,
      correlationId,
      context: input.context,
      capability: 'DOCUMENT_INTELLIGENCE',
      sourceAuthority,
      observation:
        status === 'EXTRACTED'
          ? 'Supplier source record extracted with sufficient identity evidence.'
          : 'Supplier source record requires review before downstream reconciliation.',
      payload: {
        documentId,
        sourceRowKey: record.sourceRowKey,
        productName: record.productName,
        supplierReference: record.supplierReference,
        sourcePage: record.sourcePage,
        extractionStatus: status,
      },
      confidence,
      fingerprint,
      createdAt,
    });

    preparedRecords.push({
      documentId,
      ...record,
      extractionStatus: status,
      evidence: {
        correlationId,
        evidenceId,
        fingerprint,
        schemaVersion,
        sourceAuthority: sourceAuthority.level,
      },
    });
  }

  const providerWarnings = [
    ...providerResult.messages,
    ...providerResult.data.warnings,
  ];
  const requiresReview =
    providerResult.status === 'PARTIAL' ||
    providerWarnings.length > 0 ||
    preparedRecords.length === 0 ||
    preparedRecords.some((record) => record.extractionStatus !== 'EXTRACTED');

  const allEvidenceIds = [
    documentEvidence.evidenceId,
    ...recordEvidence.map((item) => item.evidenceId),
  ];

  const recommendation = requiresReview
    ? reviewRecommendation({
        correlationId,
        context: input.context,
        evidenceIds: allEvidenceIds,
        createdAt,
        confidence: documentConfidence,
        reasons: [
          `Provider status=${providerResult.status}.`,
          `Warnings=${providerWarnings.length}.`,
          `Prepared records=${preparedRecords.length}.`,
          `Records requiring review=${preparedRecords.filter((record) => record.extractionStatus !== 'EXTRACTED').length}.`,
        ],
      })
    : undefined;

  return {
    documentEvidence,
    recordEvidence,
    preparedRecords,
    ...(recommendation ? { recommendation } : {}),
    providerWarnings,
  };
}

export function createDocumentIntelligenceCapabilityHandler(input: {
  readonly tools: DocumentIntelligenceTools;
  readonly config: DocumentIntelligenceExecutionConfig;
  readonly createdAt: () => string;
}): IntelligenceCapabilityHandler {
  return {
    capability: 'DOCUMENT_INTELLIGENCE',
    async execute(executionInput) {
      const result = await executeDocumentIntelligence(input.tools, {
        correlationId: executionInput.correlationId,
        requestedBy: executionInput.requestedBy,
        context: executionInput.context,
        config: input.config,
        createdAt: input.createdAt(),
      });

      return {
        capability: 'DOCUMENT_INTELLIGENCE',
        evidence: [
          result.documentEvidence,
          ...result.recordEvidence,
        ],
        candidates: [],
        recommendations: result.recommendation
          ? [result.recommendation]
          : [],
        messages: [
          `Prepared ${result.preparedRecords.length} supplier source record(s).`,
          ...result.providerWarnings,
        ],
      };
    },
  };
}
