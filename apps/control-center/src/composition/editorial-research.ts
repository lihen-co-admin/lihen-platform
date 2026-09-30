import { getBrowserSupabaseClient } from '@lihen/database';
import type { EditorialResearchReport } from '@lihen/intelligence-core';

import { acceptResearchEvidence, type EditorialGrounding } from './editorial-grounding';

interface EditorialResearchRuntimeResponse {
  readonly runtime: string;
  readonly action: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly report: EditorialResearchReport;
}

interface EdgeInvokeResult<T> {
  readonly data: T | null;
  readonly error: {
    readonly message?: string;
  } | null;
}

export interface EditorialResearchEdgeFunctionClient {
  readonly functions: {
    invoke<T>(
      functionName: string,
      options: {
        readonly body: Readonly<Record<string, unknown>>;
      },
    ): PromiseLike<EdgeInvokeResult<T>>;
  };
}

export interface EditorialResearchReadiness {
  readonly featureEnabled: boolean;
  readonly providerConfigured: boolean;
  readonly allowlistConfigured: boolean;
  readonly authorityRegistryConfigured: boolean;
  readonly freeOnlyConfigured: boolean;
  readonly dependenciesConfigured: boolean;
  readonly readyForActivation: boolean;
  readonly reasons: readonly string[];
}

export interface EditorialResearchPreflightResponse {
  readonly runtime: 'LIHEN_INTELLIGENCE';
  readonly action: 'EDITORIAL_RESEARCH_PREFLIGHT';
  readonly readiness: EditorialResearchReadiness;
}

const readinessBooleanFields = [
  'featureEnabled',
  'providerConfigured',
  'allowlistConfigured',
  'authorityRegistryConfigured',
  'freeOnlyConfigured',
  'dependenciesConfigured',
  'readyForActivation',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPreflightResponse(value: unknown): value is EditorialResearchPreflightResponse {
  if (
    !isRecord(value) ||
    value.runtime !== 'LIHEN_INTELLIGENCE' ||
    value.action !== 'EDITORIAL_RESEARCH_PREFLIGHT' ||
    !isRecord(value.readiness)
  ) {
    return false;
  }

  const readiness = value.readiness;
  return (
    Object.keys(value).length === 3 &&
    Object.keys(readiness).length === readinessBooleanFields.length + 1 &&
    readinessBooleanFields.every((field) => typeof readiness[field] === 'boolean') &&
    Array.isArray(readiness.reasons) &&
    readiness.reasons.every((reason: unknown) => typeof reason === 'string')
  );
}

/** Explicit, configuration-free assessment; never executes Editorial Research. */
export async function preflightEditorialResearchWithClient(
  client: EditorialResearchEdgeFunctionClient,
): Promise<EditorialResearchReadiness> {
  let result: EdgeInvokeResult<unknown>;
  try {
    result = await client.functions.invoke<unknown>('intelligence-runtime', {
      body: { action: 'EDITORIAL_RESEARCH_PREFLIGHT' },
    });
  } catch {
    throw new Error('LIHEN_EDITORIAL_RESEARCH_PREFLIGHT_INVOKE_FAILED');
  }

  if (result.error) {
    throw new Error('LIHEN_EDITORIAL_RESEARCH_PREFLIGHT_INVOKE_FAILED');
  }
  if (!isPreflightResponse(result.data)) {
    throw new Error('LIHEN_EDITORIAL_RESEARCH_PREFLIGHT_INVALID_RESPONSE');
  }
  return result.data.readiness;
}

/** Browser boundary: reuse the Control Center client and its authenticated session. */
export async function preflightEditorialResearch(): Promise<EditorialResearchReadiness> {
  return preflightEditorialResearchWithClient(getBrowserSupabaseClient(import.meta.env));
}

export async function researchEditorialGroundingWithClient(
  internal: EditorialGrounding,
  client: EditorialResearchEdgeFunctionClient,
): Promise<EditorialGrounding> {
  const productId = internal.productIdentity.productId.trim();

  if (!productId) {
    throw new Error('LIHEN_EDITORIAL_RESEARCH_PRODUCT_ID_REQUIRED');
  }

  const { data, error } = await client.functions.invoke<EditorialResearchRuntimeResponse>(
    'intelligence-runtime',
    {
      body: {
        action: 'EDITORIAL_RESEARCH',
        productId,
      },
    },
  );

  if (error) {
    throw new Error(`LIHEN_EDITORIAL_RESEARCH_RUNTIME_INVOKE_FAILED:${error.message ?? 'UNKNOWN'}`);
  }

  if (
    !data ||
    data.runtime !== 'LIHEN_INTELLIGENCE' ||
    data.action !== 'EDITORIAL_RESEARCH' ||
    !data.report
  ) {
    throw new Error('LIHEN_EDITORIAL_RESEARCH_RUNTIME_INVALID_RESPONSE');
  }

  return acceptResearchEvidence(internal, data.report);
}

/**
 * Browser boundary.
 *
 * Product identity is reconstructed server-side from Product Master.
 * Provider credentials, authority domains and FREE_ONLY governance never
 * originate in the browser.
 */
export async function researchEditorialGrounding(
  internal: EditorialGrounding,
): Promise<EditorialGrounding> {
  return researchEditorialGroundingWithClient(internal, getBrowserSupabaseClient(import.meta.env));
}
