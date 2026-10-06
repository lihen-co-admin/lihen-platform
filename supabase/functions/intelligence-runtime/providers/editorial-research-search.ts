import type { EditorialAuthorityRecord } from '../../../../packages/intelligence-core/src/capabilities/editorial-research.ts';
import type { SearchPort } from '../../../../packages/intelligence-core/src/provider-ports.ts';

import { createEditorialEvidenceSearchPort } from './editorial-evidence-search.ts';
import { createOfficialDomainDiscoveryPort } from './official-domain-discovery.ts';
import { officialDiscoveryAuthorities } from './editorial-authority-registry.ts';

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

  const evidenceRef = config.freeOnlyEvidenceRef?.trim();
  const verifiedAt = config.freeOnlyVerifiedAt?.trim();
  const allowedDomains = normalizeDomains(config.allowedDomains);

  const authorities = officialDiscoveryAuthorities(config.authorities ?? [], allowedDomains);
  if (!evidenceRef || !validTime(verifiedAt) || authorities.length === 0) {
    return {};
  }

  const discovery = createOfficialDomainDiscoveryPort({
    authorities,
    allowedDomains,
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
