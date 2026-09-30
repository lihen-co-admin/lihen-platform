import type {
  ProviderResult,
  SearchPort,
  SearchProductIdentity,
  SearchRequest,
  SearchResultItem,
} from '../../../../packages/intelligence-core/src/provider-ports.ts';

import { extractEditorialProductEvidence } from './editorial-evidence-extractor.ts';
import {
  fetchEditorialEvidenceDocument,
  type EditorialEvidenceFetchOptions,
} from './editorial-evidence-fetcher.ts';

export interface EditorialEvidenceSearchOptions {
  readonly discovery: SearchPort;
  readonly allowedDomains: readonly string[];
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}

function normalizeDomains(domains: readonly string[]): readonly string[] {
  return [...new Set(domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean))];
}

function resultDomain(item: SearchResultItem): string | undefined {
  try {
    const url = new URL(item.uri);

    if (url.protocol !== 'https:' || url.username || url.password || url.port) {
      return undefined;
    }

    return url.hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

async function enrichResult(
  item: SearchResultItem,
  expected: SearchProductIdentity,
  allowedDomains: readonly string[],
  options: EditorialEvidenceFetchOptions,
): Promise<SearchResultItem> {
  const domain = resultDomain(item);

  if (!domain || !allowedDomains.includes(domain)) {
    return item;
  }

  try {
    const document = await fetchEditorialEvidenceDocument(item.uri, {
      ...options,
      allowedDomains,
    });

    const extracted = extractEditorialProductEvidence(document, expected);

    return {
      ...item,
      productEvidence: extracted.evidence,
    };
  } catch {
    /*
     * Evidence retrieval is fail-closed per result. Discovery metadata may
     * remain visible to orchestration, but failed retrieval never becomes
     * productEvidence.
     */
    return item;
  }
}

export function createEditorialEvidenceSearchPort(
  options: EditorialEvidenceSearchOptions,
): SearchPort {
  const allowedDomains = normalizeDomains(options.allowedDomains);

  return {
    descriptor: options.discovery.descriptor,

    async search(request: SearchRequest): Promise<ProviderResult<readonly SearchResultItem[]>> {
      const discovered = await options.discovery.search(request);

      if (
        (discovered.status !== 'SUCCESS' && discovered.status !== 'PARTIAL') ||
        !discovered.data ||
        !request.expectedProductIdentity
      ) {
        return discovered;
      }

      const enriched = await Promise.all(
        discovered.data.map((item) =>
          enrichResult(item, request.expectedProductIdentity!, allowedDomains, {
            fetchImpl: options.fetchImpl,
            timeoutMs: options.timeoutMs,
            maxBytes: options.maxBytes,
          }),
        ),
      );

      return {
        ...discovered,
        data: enriched,
      };
    },
  };
}
