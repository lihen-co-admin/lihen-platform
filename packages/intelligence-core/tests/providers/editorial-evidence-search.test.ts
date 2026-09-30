import { describe, expect, it, vi } from 'vitest';

import type { SearchPort, SearchRequest } from '../../src/provider-ports';

import { createEditorialEvidenceSearchPort } from '../../../../supabase/functions/intelligence-runtime/providers/editorial-evidence-search';

const identity = {
  productId: 'product-067',
  productName: 'Agua de rosas',
  sku: 'BC-067',
  brandId: 'brand-a',
  brand: 'Marca A',
  category: 'Cuidado facial',
} as const;

const request: SearchRequest = {
  capability: 'BRAND_INTELLIGENCE',
  correlationId: 'test-correlation',
  queries: [{ query: 'Agua de rosas Marca A BC-067' }],
  expectedProductIdentity: identity,
  costPolicy: 'FREE_ONLY',
};

function discovery(
  data: readonly {
    title: string;
    uri: string;
  }[],
): SearchPort {
  return {
    descriptor: {
      id: 'fixture-search',
      kind: 'SEARCH',
      readOnly: true,
    },
    search: vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      data,
    }),
  };
}

describe('Editorial evidence search port', () => {
  it('enriches an authorized result with exact identity evidence', async () => {
    const port = createEditorialEvidenceSearchPort({
      discovery: discovery([
        {
          title: 'Agua de rosas',
          uri: 'https://brand.example/product',
        },
      ]),
      allowedDomains: ['brand.example'],
      fetchImpl: vi.fn().mockResolvedValue(
        new Response('<h1>Agua de rosas</h1><p>Marca A · BC-067 · Cuidado facial</p>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
      ) as typeof fetch,
    });

    const result = await port.search(request);

    expect(result.data?.[0]?.productEvidence?.identity.sku?.value).toBe('BC-067');
    expect(result.data?.[0]?.productEvidence?.identity.brand?.value).toBe('Marca A');
    expect(result.data?.[0]?.productEvidence?.claims).toEqual([]);
  });

  it('never fetches outside the allowlist', async () => {
    const fetchImpl = vi.fn();

    const port = createEditorialEvidenceSearchPort({
      discovery: discovery([
        {
          title: 'Untrusted',
          uri: 'https://untrusted.example/product',
        },
      ]),
      allowedDomains: ['brand.example'],
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search(request);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.data?.[0]?.productEvidence).toBeUndefined();
  });

  it('fails closed per result when retrieval fails', async () => {
    const port = createEditorialEvidenceSearchPort({
      discovery: discovery([
        {
          title: 'Product',
          uri: 'https://brand.example/product',
        },
      ]),
      allowedDomains: ['brand.example'],
      fetchImpl: vi.fn().mockRejectedValue(new Error('network unavailable')) as typeof fetch,
    });

    const result = await port.search(request);

    expect(result.status).toBe('SUCCESS');
    expect(result.data?.[0]?.productEvidence).toBeUndefined();
  });

  it('does not fetch without expected product identity', async () => {
    const fetchImpl = vi.fn();

    const port = createEditorialEvidenceSearchPort({
      discovery: discovery([
        {
          title: 'Product',
          uri: 'https://brand.example/product',
        },
      ]),
      allowedDomains: ['brand.example'],
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search({
      ...request,
      expectedProductIdentity: undefined,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.data?.[0]?.productEvidence).toBeUndefined();
  });

  it('preserves a failed discovery result without fetching', async () => {
    const fetchImpl = vi.fn();

    const failedDiscovery: SearchPort = {
      descriptor: {
        id: 'fixture-search',
        kind: 'SEARCH',
        readOnly: true,
      },
      search: vi.fn().mockResolvedValue({
        status: 'RATE_LIMITED',
        error: {
          code: 'RATE_LIMITED',
          message: 'rate limited',
        },
      }),
    };

    const port = createEditorialEvidenceSearchPort({
      discovery: failedDiscovery,
      allowedDomains: ['brand.example'],
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search(request);

    expect(result.status).toBe('RATE_LIMITED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
