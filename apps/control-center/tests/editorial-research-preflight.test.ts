import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBrowserSupabaseClient } from '@lihen/database';
import {
  preflightEditorialResearch,
  preflightEditorialResearchWithClient,
  type EditorialResearchEdgeFunctionClient,
  type EditorialResearchPreflightResponse,
} from '../src/composition/editorial-research';

vi.mock('@lihen/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@lihen/database')>()),
  getBrowserSupabaseClient: vi.fn(),
}));

const response: EditorialResearchPreflightResponse = {
  runtime: 'LIHEN_INTELLIGENCE',
  action: 'EDITORIAL_RESEARCH_PREFLIGHT',
  readiness: {
    featureEnabled: false,
    providerConfigured: true,
    allowlistConfigured: true,
    authorityRegistryConfigured: true,
    freeOnlyConfigured: true,
    dependenciesConfigured: true,
    readyForActivation: false,
    reasons: ['FEATURE_DISABLED'],
  },
};
const booleanFields = [
  'featureEnabled',
  'providerConfigured',
  'allowlistConfigured',
  'authorityRegistryConfigured',
  'freeOnlyConfigured',
  'dependenciesConfigured',
  'readyForActivation',
] as const;
const invokeFailed = 'LIHEN_EDITORIAL_RESEARCH_PREFLIGHT_INVOKE_FAILED';
const invalidResponse = 'LIHEN_EDITORIAL_RESEARCH_PREFLIGHT_INVALID_RESPONSE';

function client(
  data: unknown,
  error: { message?: string } | null = null,
): EditorialResearchEdgeFunctionClient {
  return { functions: { invoke: vi.fn().mockResolvedValue({ data, error }) } };
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('REAL_NETWORK_FORBIDDEN');
    }),
  );
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('Editorial Research browser preflight bridge', () => {
  it('invokes exactly once with only the preflight action and returns valid readiness', async () => {
    const edge = client(response);
    expect(await preflightEditorialResearchWithClient(edge)).toEqual(response.readiness);
    expect(edge.functions.invoke).toHaveBeenCalledExactlyOnceWith('intelligence-runtime', {
      body: { action: 'EDITORIAL_RESEARCH_PREFLIGHT' },
    });
    expect(edge.functions.invoke).not.toHaveBeenCalledWith('intelligence-runtime', {
      body: { action: 'EDITORIAL_RESEARCH' },
    });
  });

  it('accepts ready configuration and empty reasons without activating anything', async () => {
    const readiness = {
      ...response.readiness,
      featureEnabled: true,
      readyForActivation: true,
      reasons: [],
    };
    expect(await preflightEditorialResearchWithClient(client({ ...response, readiness }))).toEqual(
      readiness,
    );
  });

  it('fails with a stable error and never propagates raw invoke messages, even with valid data', async () => {
    await expect(
      preflightEditorialResearchWithClient(client(response, { message: 'secret-upstream-detail' })),
    ).rejects.toThrow(new Error(invokeFailed));
  });

  it('normalizes rejected invocations without exposing their details', async () => {
    const edge = client(null);
    vi.mocked(edge.functions.invoke).mockRejectedValue(new Error('secret-transport-detail'));
    await expect(preflightEditorialResearchWithClient(edge)).rejects.toThrow(
      new Error(invokeFailed),
    );
    expect(edge.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    undefined,
    false,
    'invalid',
    [],
    {},
    { ...response, runtime: 'WRONG_RUNTIME' },
    { ...response, action: 'EDITORIAL_RESEARCH' },
    { ...response, action: 'WRONG_ACTION' },
    { runtime: response.runtime, action: response.action },
    { ...response, readiness: null },
    { ...response, readiness: [] },
    { ...response, readiness: {} },
    { ...response, readiness: { readyForActivation: true } },
    { ...response, readiness: { ...response.readiness, reasons: null } },
    { ...response, readiness: { ...response.readiness, reasons: 'FEATURE_DISABLED' } },
    { ...response, readiness: { ...response.readiness, reasons: [1] } },
    { ...response, readiness: { ...response.readiness, reasons: ['FEATURE_DISABLED', null] } },
    { ...response, readiness: { ...response.readiness, evidenceRef: 'secret-extra' } },
    { ...response, apiKey: 'secret-extra' },
  ])('rejects malformed or unexpected response %#', async (data) => {
    await expect(preflightEditorialResearchWithClient(client(data))).rejects.toThrow(
      new Error(invalidResponse),
    );
  });

  it.each(booleanFields)('requires the boolean field %s without coercion', async (field) => {
    for (const value of [undefined, null, 'true', 1, {}, []]) {
      await expect(
        preflightEditorialResearchWithClient(
          client({
            ...response,
            readiness: { ...response.readiness, [field]: value },
          }),
        ),
      ).rejects.toThrow(new Error(invalidResponse));
    }
    const readiness: Record<string, unknown> = { ...response.readiness };
    delete readiness[field];
    await expect(
      preflightEditorialResearchWithClient(client({ ...response, readiness })),
    ).rejects.toThrow(new Error(invalidResponse));
  });

  it('requires the reasons array', async () => {
    const readiness: Record<string, unknown> = { ...response.readiness };
    delete readiness.reasons;
    await expect(
      preflightEditorialResearchWithClient(client({ ...response, readiness })),
    ).rejects.toThrow(new Error(invalidResponse));
  });

  it('uses the existing browser client/session only on explicit invocation', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: response, error: null });
    const browserClient = Object.assign({}, { functions: { invoke } }) as unknown as ReturnType<
      typeof getBrowserSupabaseClient
    >;
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(browserClient);
    expect(getBrowserSupabaseClient).not.toHaveBeenCalled();
    expect(await preflightEditorialResearch()).toEqual(response.readiness);
    expect(getBrowserSupabaseClient).toHaveBeenCalledExactlyOnceWith(import.meta.env);
    expect(invoke).toHaveBeenCalledExactlyOnceWith('intelligence-runtime', {
      body: { action: 'EDITORIAL_RESEARCH_PREFLIGHT' },
    });
    const source = readFileSync(
      new URL('../src/composition/editorial-research.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain(
      'preflightEditorialResearchWithClient(getBrowserSupabaseClient(import.meta.env))',
    );
  });
});
