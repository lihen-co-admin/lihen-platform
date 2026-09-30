import { describe, expect, it, vi } from 'vitest';

import type { EditorialResearchReport } from '@lihen/intelligence-core';

import {
  researchEditorialGroundingWithClient,
  type EditorialResearchEdgeFunctionClient,
} from '../src/composition/editorial-research';
import { internalEditorialGrounding } from '../src/composition/editorial-grounding';

const product = {
  id: 'product-067',
  name: 'Agua de rosas',
  sku: 'BC-067',
  brandId: 'brand-a',
  brandName: 'Marca A',
  categoryName: 'Cuidado facial',
  catalogCode: 'CAT-067',
  businessLine: 'BEAUTY_CARE' as const,
  status: 'ACTIVE' as const,
  salePrice: {
    amount: 10000,
    currency: 'COP' as const,
  },
};

function report(overrides: Partial<EditorialResearchReport> = {}): EditorialResearchReport {
  return {
    identity: {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      brandId: product.brandId,
      brand: product.brandName,
      category: product.categoryName,
    },
    query: null,
    status: 'SEARCH_PROVIDER_NOT_CONFIGURED',
    evidenceStatus: 'INSUFFICIENT_EVIDENCE',
    sources: [],
    ...overrides,
  };
}

function client(result: {
  data: unknown;
  error: { message?: string } | null;
}): EditorialResearchEdgeFunctionClient {
  return {
    functions: {
      invoke: vi.fn().mockResolvedValue(result),
    },
  };
}

describe('editorial research runtime boundary', () => {
  it('sends only action and productId to intelligence-runtime', async () => {
    const internal = internalEditorialGrounding(product, '2026-09-29T20:00:00.000Z');

    const edge = client({
      data: {
        runtime: 'LIHEN_INTELLIGENCE',
        action: 'EDITORIAL_RESEARCH',
        requestId: 'request-1',
        correlationId: 'correlation-1',
        report: report(),
      },
      error: null,
    });

    await researchEditorialGroundingWithClient(internal, edge);

    expect(edge.functions.invoke).toHaveBeenCalledWith('intelligence-runtime', {
      body: {
        action: 'EDITORIAL_RESEARCH',
        productId: product.id,
      },
    });
  });

  it('accepts a matching governed report', async () => {
    const internal = internalEditorialGrounding(product, '2026-09-29T20:00:00.000Z');

    const result = await researchEditorialGroundingWithClient(
      internal,
      client({
        data: {
          runtime: 'LIHEN_INTELLIGENCE',
          action: 'EDITORIAL_RESEARCH',
          requestId: 'request-1',
          correlationId: 'correlation-1',
          report: report(),
        },
        error: null,
      }),
    );

    expect(result.evidence.externalResearch).toBe('NOT_CONFIGURED');
  });

  it('rejects a product identity mismatch', async () => {
    const internal = internalEditorialGrounding(product, '2026-09-29T20:00:00.000Z');

    await expect(
      researchEditorialGroundingWithClient(
        internal,
        client({
          data: {
            runtime: 'LIHEN_INTELLIGENCE',
            action: 'EDITORIAL_RESEARCH',
            requestId: 'request-1',
            correlationId: 'correlation-1',
            report: report({
              identity: {
                ...report().identity,
                productId: 'different-product',
              },
            }),
          },
          error: null,
        }),
      ),
    ).rejects.toThrow('EDITORIAL_PRODUCT_IDENTITY_MISMATCH');
  });

  it('rejects edge invocation failure', async () => {
    const internal = internalEditorialGrounding(product, '2026-09-29T20:00:00.000Z');

    await expect(
      researchEditorialGroundingWithClient(
        internal,
        client({
          data: null,
          error: { message: 'unavailable' },
        }),
      ),
    ).rejects.toThrow('LIHEN_EDITORIAL_RESEARCH_RUNTIME_INVOKE_FAILED:unavailable');
  });

  it('rejects invalid runtime response', async () => {
    const internal = internalEditorialGrounding(product, '2026-09-29T20:00:00.000Z');

    await expect(
      researchEditorialGroundingWithClient(
        internal,
        client({
          data: {
            runtime: 'LIHEN_INTELLIGENCE',
            action: 'WRONG_ACTION',
          },
          error: null,
        }),
      ),
    ).rejects.toThrow('LIHEN_EDITORIAL_RESEARCH_RUNTIME_INVALID_RESPONSE');
  });
});
