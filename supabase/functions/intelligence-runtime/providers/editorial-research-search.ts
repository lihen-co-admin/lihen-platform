import type { EditorialAuthorityRecord } from '../../../../packages/intelligence-core/src/capabilities/editorial-research.ts';
import type { SearchPort } from '../../../../packages/intelligence-core/src/provider-ports.ts';

import { createEditorialEvidenceSearchPort } from './editorial-evidence-search.ts';
import { createGroqSearchPort } from './groq-search.ts';

export interface EditorialResearchSearchConfig {
  readonly enabled?: boolean;
  readonly groqApiKey?: string;
  readonly allowedDomains?: readonly string[];
  readonly authorities?: readonly EditorialAuthorityRecord[];
  readonly freeOnlyEvidenceRef?: string;
  readonly freeOnlyVerifiedAt?: string;
  readonly fetchImpl?: typeof fetch;
}

export interface EditorialResearchRuntimeDependencies {
  readonly search?: SearchPort;
  readonly authorities?: readonly EditorialAuthorityRecord[];
  readonly freeOnly?: {
    readonly evidenceRef: string;
    readonly verifiedAt: string;
  };
}

function validTime(value: string | undefined): value is string {
  return Boolean(value?.trim() && Number.isFinite(Date.parse(value)));
}

function normalizeDomains(domains: readonly string[] | undefined): readonly string[] {
  return [...new Set((domains ?? []).map((domain) => domain.trim().toLowerCase()).filter(Boolean))];
}

export function createEditorialResearchRuntimeDependencies(
  config: EditorialResearchSearchConfig,
): EditorialResearchRuntimeDependencies {
  if (config.enabled !== true) {
    return {};
  }

  const apiKey = config.groqApiKey?.trim();
  const evidenceRef = config.freeOnlyEvidenceRef?.trim();
  const verifiedAt = config.freeOnlyVerifiedAt?.trim();
  const allowedDomains = normalizeDomains(config.allowedDomains);

  if (!apiKey || !evidenceRef || !validTime(verifiedAt) || allowedDomains.length === 0) {
    return {};
  }

  const discovery = createGroqSearchPort({
    apiKey,
    enabled: true,
    fetchImpl: config.fetchImpl,
  });

  const search = createEditorialEvidenceSearchPort({
    discovery,
    allowedDomains,
    fetchImpl: config.fetchImpl,
  });

  return {
    search,
    authorities: config.authorities ?? [],
    freeOnly: {
      evidenceRef,
      verifiedAt,
    },
  };
}
