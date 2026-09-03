import { describe, expect, it } from 'vitest';

import {
  createDocumentIntelligenceCapabilityHandler,
  executeDocumentIntelligence,
  type DocumentIntelligenceTools,
  type IntelligenceContext,
} from '../src';
import type {
  DocumentExtractionRequest,
  DocumentExtractionPort,
  ProviderResult,
  ToolDescriptor,
} from '../src';

const descriptor: ToolDescriptor = {
  toolId: 'document-test',
  kind: 'DOCUMENT',
  name: 'Document Test Port',
  version: '1',
  description: 'Test-only document extractor.',
  readOnly: true,
};

const context: IntelligenceContext = {
  contextId: 'document:doc-1',
  type: 'DOCUMENT',
  entityId: 'doc-1',
  businessLine: 'BEAUTY_CARE',
  attributes: {},
};

function port(
  result: ProviderResult<{
    documentRef: string;
    fields: Readonly<Record<string, unknown>>;
    pages: readonly number[];
    warnings: readonly string[];
  }>,
): DocumentExtractionPort {
  return {
    descriptor,
    async extract(_request: DocumentExtractionRequest) {
      return result;
    },
  };
}

function tools(document: DocumentExtractionPort): DocumentIntelligenceTools {
  return { document };
}

describe('GAP-019 Document Intelligence', () => {
  it('extracts structured supplier records and produces evidence without canonical mutation', async () => {
    const result = await executeDocumentIntelligence(
      tools(
        port({
          status: 'SUCCESS',
          data: {
            documentRef: 'doc-1',
            fields: {
              records: [
                {
                  sourceRowKey: 'p1-r1',
                  sourcePage: 1,
                  productName: 'Producto A',
                  supplierReference: 'SUP-001',
                  businessLine: 'BEAUTY_CARE',
                  unitCost: 10000,
                  extractionConfidence: 0.95,
                },
              ],
            },
            pages: [1],
            warnings: [],
          },
          messages: [],
        }),
      ),
      {
        correlationId: 'corr-1',
        requestedBy: 'user-1',
        context,
        config: {
          documentId: 'doc-1',
          sourceName: 'Proveedor Test',
          extractionSchemaVersion: 'v1',
        },
        createdAt: '2026-09-03T15:00:00.000Z',
      },
    );

    expect(result.preparedRecords).toHaveLength(1);
    expect(result.preparedRecords[0]).toMatchObject({
      documentId: 'doc-1',
      sourceRowKey: 'p1-r1',
      extractionStatus: 'EXTRACTED',
      productName: 'Producto A',
    });
    expect(result.documentEvidence.capability).toBe('DOCUMENT_INTELLIGENCE');
    expect(result.recordEvidence[0]?.correlationId).toBe('corr-1');
    expect(result.recommendation).toBeUndefined();
  });

  it('requires review when product identity is insufficient', async () => {
    const result = await executeDocumentIntelligence(
      tools(
        port({
          status: 'SUCCESS',
          data: {
            documentRef: 'doc-1',
            fields: {
              records: [
                {
                  sourceRowKey: 'p1-r1',
                  sourcePage: 1,
                  rawText: 'Producto no identificado',
                  extractionConfidence: 0.5,
                },
              ],
            },
            pages: [1],
            warnings: [],
          },
          messages: [],
        }),
      ),
      {
        correlationId: 'corr-2',
        requestedBy: 'user-1',
        context,
        config: {
          documentId: 'doc-1',
          sourceName: 'Proveedor Test',
          extractionSchemaVersion: 'v1',
        },
        createdAt: '2026-09-03T15:00:00.000Z',
      },
    );

    expect(result.preparedRecords[0]?.extractionStatus).toBe('REVIEW_REQUIRED');
    expect(result.recommendation?.risk).toMatchObject({
      level: 'R2',
      requiresHumanReview: true,
    });
    expect(result.recommendation?.actionType).toBe(
      'REVIEW_DOCUMENT_EXTRACTION',
    );
  });

  it('preserves provider warnings as review reasons', async () => {
    const result = await executeDocumentIntelligence(
      tools(
        port({
          status: 'PARTIAL',
          data: {
            documentRef: 'doc-1',
            fields: {
              records: [
                {
                  sourceRowKey: 'p1-r1',
                  productName: 'Producto A',
                  extractionConfidence: 0.9,
                },
              ],
            },
            pages: [1],
            warnings: ['Page 2 could not be parsed.'],
          },
          messages: ['Partial extraction.'],
        }),
      ),
      {
        correlationId: 'corr-3',
        requestedBy: 'user-1',
        context,
        config: {
          documentId: 'doc-1',
          sourceName: 'Proveedor Test',
          extractionSchemaVersion: 'v1',
        },
        createdAt: '2026-09-03T15:00:00.000Z',
      },
    );

    expect(result.providerWarnings).toEqual([
      'Partial extraction.',
      'Page 2 could not be parsed.',
    ]);
    expect(result.recommendation).toBeDefined();
  });

  it('rejects duplicate source row keys', async () => {
    await expect(
      executeDocumentIntelligence(
        tools(
          port({
            status: 'SUCCESS',
            data: {
              documentRef: 'doc-1',
              fields: {
                records: [
                  { sourceRowKey: 'dup', productName: 'A', extractionConfidence: 0.9 },
                  { sourceRowKey: 'dup', productName: 'B', extractionConfidence: 0.9 },
                ],
              },
              pages: [1],
              warnings: [],
            },
            messages: [],
          }),
        ),
        {
          correlationId: 'corr-4',
          requestedBy: 'user-1',
          context,
          config: {
            documentId: 'doc-1',
            sourceName: 'Proveedor Test',
            extractionSchemaVersion: 'v1',
          },
          createdAt: '2026-09-03T15:00:00.000Z',
        },
      ),
    ).rejects.toThrow('DOCUMENT_INTELLIGENCE_SOURCE_ROW_KEY_DUPLICATE');
  });

  it('does not accept invalid business lines', async () => {
    await expect(
      executeDocumentIntelligence(
        tools(
          port({
            status: 'SUCCESS',
            data: {
              documentRef: 'doc-1',
              fields: {
                records: [
                  {
                    sourceRowKey: 'r1',
                    productName: 'A',
                    businessLine: 'OTHER',
                    extractionConfidence: 0.9,
                  },
                ],
              },
              pages: [1],
              warnings: [],
            },
            messages: [],
          }),
        ),
        {
          correlationId: 'corr-5',
          requestedBy: 'user-1',
          context,
          config: {
            documentId: 'doc-1',
            sourceName: 'Proveedor Test',
            extractionSchemaVersion: 'v1',
          },
          createdAt: '2026-09-03T15:00:00.000Z',
        },
      ),
    ).rejects.toThrow('DOCUMENT_INTELLIGENCE_BUSINESS_LINE_INVALID');
  });

  it('fails closed when the document provider is unavailable', async () => {
    await expect(
      executeDocumentIntelligence(
        tools(
          port({
            status: 'UNAVAILABLE',
            messages: ['provider unavailable'],
          }),
        ),
        {
          correlationId: 'corr-6',
          requestedBy: 'user-1',
          context,
          config: {
            documentId: 'doc-1',
            sourceName: 'Proveedor Test',
            extractionSchemaVersion: 'v1',
          },
          createdAt: '2026-09-03T15:00:00.000Z',
        },
      ),
    ).rejects.toThrow('DOCUMENT_INTELLIGENCE_PROVIDER_UNAVAILABLE');
  });

  it('exposes an Orchestrator-compatible DOCUMENT_INTELLIGENCE handler', async () => {
    const handler = createDocumentIntelligenceCapabilityHandler({
      tools: tools(
        port({
          status: 'SUCCESS',
          data: {
            documentRef: 'doc-1',
            fields: {
              records: [
                {
                  sourceRowKey: 'r1',
                  productName: 'Producto A',
                  extractionConfidence: 0.99,
                },
              ],
            },
            pages: [1],
            warnings: [],
          },
          messages: [],
        }),
      ),
      config: {
        documentId: 'doc-1',
        sourceName: 'Proveedor Test',
        extractionSchemaVersion: 'v1',
      },
      createdAt: () => '2026-09-03T15:00:00.000Z',
    });

    const output = await handler.execute({
      requestId: 'req-1',
      correlationId: 'corr-7',
      requestedBy: 'user-1',
      context,
      intent: {
        intentId: 'intent-1',
        name: 'Extract supplier document',
        description: 'Extract supplier records',
        requestedCapabilities: ['DOCUMENT_INTELLIGENCE'],
        requiresVerification: true,
        expectedOutput: 'EVIDENCE',
      },
      priorEvidence: [],
    });

    expect(output.capability).toBe('DOCUMENT_INTELLIGENCE');
    expect(output.evidence).toHaveLength(2);
    expect(output.candidates).toEqual([]);
    expect(output.recommendations).toEqual([]);
    expect(output.messages[0]).toContain('Prepared 1 supplier source record');
  });
});
