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
