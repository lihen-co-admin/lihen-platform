import { describe, expect, it, vi } from 'vitest';
import { createGroqSearchPort } from '../../../../supabase/functions/intelligence-runtime/providers/groq-search';

const request = {
  correlationId: 'corr-test' as never,
  requestedBy: 'test-user',
  context: {} as never,
  queries: [
    {
      query: 'Agua de rosas Marca A SKU BC-067',
    },
  ],
  expectedProductIdentity: {
    productId: 'product-1',
    productName: 'Agua de rosas',
    sku: 'BC-067',
    brandId: 'brand-a',
    brand: 'Marca A',
    category: 'Beauty Care',
  },
  costPolicy: 'FREE_ONLY' as const,
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

describe('Groq SearchPort', () => {
  it('is disabled by default and performs zero network calls', async () => {
    const fetchImpl = vi.fn();

    const port = createGroqSearchPort({
      apiKey: 'server-secret',
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search(request);

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.messages).toContain('SEARCH_PROVIDER_NOT_CONFIGURED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires FREE_ONLY and performs zero network calls otherwise', async () => {
    const fetchImpl = vi.fn();

    const port = createGroqSearchPort({
      apiKey: 'server-secret',
      enabled: true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search({
      ...request,
      costPolicy: undefined,
    });

    expect(result.status).toBe('FAILED');
    expect(result.messages).toContain('GROQ_SEARCH_FREE_ONLY_REQUIRED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires a server-side API key before network access', async () => {
    const fetchImpl = vi.fn();

    const port = createGroqSearchPort({
      apiKey: '   ',
      enabled: true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search(request);

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.messages).toContain('GROQ_API_KEY_NOT_CONFIGURED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects models outside the governed model', async () => {
    const fetchImpl = vi.fn();

    const port = createGroqSearchPort({
      apiKey: 'server-secret',
      enabled: true,
      model: 'another-model',
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search(request);

    expect(result.status).toBe('FAILED');
    expect(result.messages).toContain('GROQ_SEARCH_MODEL_NOT_ALLOWED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps 429 to RATE_LIMITED without fallback', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: 'rate limited' }, 429, { 'x-request-id': 'groq-rate-1' }),
      );

    const port = createGroqSearchPort({
      apiKey: 'server-secret',
      enabled: true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search(request);

    expect(result.status).toBe('RATE_LIMITED');
    expect(result.messages).toEqual(['GROQ_SEARCH_RATE_LIMITED']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed on network errors', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network unavailable'));

    const port = createGroqSearchPort({
      apiKey: 'server-secret',
      enabled: true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search(request);

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.messages).toContain('GROQ_SEARCH_NETWORK_FAILED');
  });

  it('does not promote undocumented browser-search tool results into SearchResultItem', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'groq-search-1',
        choices: [
          {
            message: {
              executed_tools: [
                {
                  type: 'browser_search',
                  search_results: {
                    results: [
                      {
                        title: 'Official product',
                        url: 'https://brand.example/products/rose-water',
                        content: 'Agua de rosas Marca A SKU BC-067.',
                        score: 0.99,
                      },
                      {
                        title: 'Unsafe result',
                        url: 'http://unsafe.example/product',
                        content: 'Must not be admitted.',
                      },
                      {
                        title: 'Invalid URL',
                        url: 'not-a-url',
                        content: 'Must not be admitted.',
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
        },
      }),
    );

    const port = createGroqSearchPort({
      apiKey: 'server-secret',
      enabled: true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search(request);

    expect(result.status).toBe('NO_RESULT');
    expect(result.data).toEqual([]);
    expect(result.messages).toContain('GROQ_BROWSER_SEARCH_STRUCTURED_SOURCES_UNAVAILABLE');
    expect(result.trace?.usage).toEqual({
      inputUnits: 20,
      outputUnits: 10,
    });
  });

  it('does not promote provider tool payloads into discovery or product evidence', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              executed_tools: [
                {
                  search_results: {
                    results: [
                      {
                        title: 'Same name, wrong brand',
                        url: 'https://other-brand.example/rose-water',
                        content: 'Agua de rosas Marca B with unsupported benefits.',
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      }),
    );

    const port = createGroqSearchPort({
      apiKey: 'server-secret',
      enabled: true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search(request);

    expect(result.status).toBe('NO_RESULT');
    expect(result.data).toEqual([]);
    expect(result.messages).toContain('GROQ_BROWSER_SEARCH_STRUCTURED_SOURCES_UNAVAILABLE');
  });

  it('returns NO_RESULT when browser search has no supported structured-source contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              executed_tools: [
                {
                  search_results: {
                    results: [
                      {
                        title: '',
                        url: 'https://example.com',
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      }),
    );

    const port = createGroqSearchPort({
      apiKey: 'server-secret',
      enabled: true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await port.search(request);

    expect(result.status).toBe('NO_RESULT');
    expect(result.data).toEqual([]);
    expect(result.messages).toContain('GROQ_BROWSER_SEARCH_STRUCTURED_SOURCES_UNAVAILABLE');
  });

  it('sends browser_search as a required tool without structured-output mode', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [],
      }),
    );

    const port = createGroqSearchPort({
      apiKey: 'server-secret',
      enabled: true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    await port.search(request);

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [, init] = fetchImpl.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));

    expect(body.model).toBe('openai/gpt-oss-20b');
    expect(body.tool_choice).toBe('required');
    expect(body.tools).toEqual([
      {
        type: 'browser_search',
      },
    ]);
    expect(body.response_format).toBeUndefined();
  });
});
