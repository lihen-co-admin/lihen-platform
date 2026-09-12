import type {
  DocumentExtraction,
  DocumentExtractionRequest,
  IntelligenceContext,
  ProviderResult,
} from '@lihen/intelligence-core';

import type {
  DocumentExtractionBenchmarkCase,
} from '../src';

export const context: IntelligenceContext = {
  contextId: 'document:benchmark-doc-1',
  type: 'DOCUMENT',
  entityId: 'benchmark-doc-1',
  businessLine: 'BEAUTY_CARE',
  attributes: {},
};

export function request(
  pageRange?: Readonly<{
    from: number;
    to: number;
  }>,
): DocumentExtractionRequest {
  return {
    correlationId: 'corr-benchmark-1',
    requestedBy: 'benchmark',
    context,
    document: {
      documentRef: 'benchmark-doc-1',
      mimeType: 'application/pdf',
      sourceUri:
        'lihen://benchmark/benchmark-doc-1',
      fingerprint: 'fixture-fingerprint',
    },
    extractionSchema: {
      type: 'object',
      required: ['records'],
    },
    ...(pageRange ? { pageRange } : {}),
  };
}

export const perfectResult:
  ProviderResult<DocumentExtraction> = {
    status: 'SUCCESS',
    data: {
      documentRef: 'benchmark-doc-1',
      fields: {
        records: [
          {
            sourceRowKey: 'p1-r1',
            sourcePage: 1,
            sourceSlot: 'A',
            productName: 'Shampoo Control Caspa',
            supplierReference: 'SUP-001',
            brandText: 'Pocion+',
            categoryText: 'Capilar',
            subcategoryText: 'Shampoo',
            businessLine: 'BEAUTY_CARE',
            unitCost: 10000,
            suggestedSalePrice: 15000,
            quantityHint: 1,
            imageReference: 'img-p1-r1',
            extractionConfidence: 0.95,
          },
        ],
      },
      pages: [1],
      warnings: [],
    },
    messages: [],
    trace: {
      providerRef: 'benchmark-fake',
      modelOrEngine: 'fixture-v1',
      requestRef: 'fixture-run-001',
      durationMs: 10,
    },
  };

export const perfectCase:
  DocumentExtractionBenchmarkCase = {
    caseId: 'BC-001',
    category: 'BEAUTY_CARE',
    scenario: 'DIGITAL_SIMPLE',
    request: request(),
    groundTruth: {
      documentRef: 'benchmark-doc-1',
      expectedPages: [1],
      records: [
        {
          recordId: 'gt-1',
          sourceRowKey: 'p1-r1',
          sourcePage: 1,
          sourceSlot: 'A',
          expected: {
            productName:
              'Shampoo Control Caspa',
            supplierReference: 'SUP-001',
            brandText: 'Pocion+',
            categoryText: 'Capilar',
            subcategoryText: 'Shampoo',
            businessLine: 'BEAUTY_CARE',
            unitCost: 10000,
            suggestedSalePrice: 15000,
            quantityHint: 1,
            imageReference: 'img-p1-r1',
          },
        },
      ],
    },
    expectations: {
      expectedStatus: 'SUCCESS',
      allowWarnings: false,
      allowPartial: false,
      requireTrace: true,
      criticalFields: [
        'productName',
        'supplierReference',
        'unitCost',
        'sourcePage',
      ],
    },
  };


export const warningResult: ProviderResult<DocumentExtraction> = {
  ...perfectResult,
  status: 'PARTIAL',
  messages: ['OCR_LOW_CONFIDENCE'],
  data: {
    ...perfectResult.data!,
    warnings: ['OCR_LOW_CONFIDENCE'],
  },
};

export const rateLimitedResult: ProviderResult<DocumentExtraction> = {
  status: 'RATE_LIMITED',
  messages: ['RATE_LIMITED'],
  trace: {
    providerRef: 'benchmark-fake',
    durationMs: 2,
  },
};

export const unavailableResult: ProviderResult<DocumentExtraction> = {
  status: 'UNAVAILABLE',
  messages: ['UNAVAILABLE'],
  trace: {
    providerRef: 'benchmark-fake',
    durationMs: 3,
  },
};
