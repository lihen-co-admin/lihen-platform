import type { EditorialResearchSearchConfig } from './editorial-research-search.ts';
import { parseEditorialAuthorityRegistry } from './editorial-authority-registry.ts';

export type EditorialResearchReadinessReason =
  | 'FEATURE_DISABLED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'ALLOWLIST_NOT_CONFIGURED'
  | 'AUTHORITY_REGISTRY_NOT_CONFIGURED'
  | 'FREE_ONLY_NOT_CONFIGURED';

export interface EditorialResearchReadiness {
  readonly featureEnabled: boolean;
  readonly providerConfigured: boolean;
  readonly allowlistConfigured: boolean;
  readonly authorityRegistryConfigured: boolean;
  readonly freeOnlyConfigured: boolean;
  readonly dependenciesConfigured: boolean;
  readonly readyForActivation: boolean;
  readonly reasons: readonly EditorialResearchReadinessReason[];
}

/** Configuration-only assessment. No provider construction, I/O, clock or activation. */
export function evaluateEditorialResearchReadiness(
  config: EditorialResearchSearchConfig,
): EditorialResearchReadiness {
  const featureEnabled = config.enabled === true;
  const providerConfigured = Boolean(config.groqApiKey?.trim());
  const domains = (config.allowedDomains ?? []).map((domain) => domain.trim().toLowerCase());
  const allowlistConfigured =
    domains.length > 0 &&
    domains.every((domain) =>
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain),
    );
  const authorities = parseEditorialAuthorityRegistry(JSON.stringify(config.authorities ?? []));
  const authorityRegistryConfigured =
    authorities.length > 0 && authorities.every((authority) => domains.includes(authority.domain));
  const freeOnlyConfigured = Boolean(
    config.freeOnlyEvidenceRef?.trim() &&
    config.freeOnlyVerifiedAt?.trim() &&
    Number.isFinite(Date.parse(config.freeOnlyVerifiedAt)),
  );
  const dependenciesConfigured =
    providerConfigured && allowlistConfigured && authorityRegistryConfigured && freeOnlyConfigured;
  const reasons: EditorialResearchReadinessReason[] = [];
  if (!featureEnabled) reasons.push('FEATURE_DISABLED');
  if (!providerConfigured) reasons.push('PROVIDER_NOT_CONFIGURED');
  if (!allowlistConfigured) reasons.push('ALLOWLIST_NOT_CONFIGURED');
  if (!authorityRegistryConfigured) reasons.push('AUTHORITY_REGISTRY_NOT_CONFIGURED');
  if (!freeOnlyConfigured) reasons.push('FREE_ONLY_NOT_CONFIGURED');
  return {
    featureEnabled,
    providerConfigured,
    allowlistConfigured,
    authorityRegistryConfigured,
    freeOnlyConfigured,
    dependenciesConfigured,
    readyForActivation: featureEnabled && dependenciesConfigured,
    reasons,
  };
}
