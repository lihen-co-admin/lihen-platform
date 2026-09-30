import type { Confidence } from '../contracts';
import type {
  IntelligenceToolContext,
  SearchPort,
  SearchProductIdentity,
  SearchResultItem,
  SearchEvidenceValue,
} from '../provider-ports';
import type { BrandIntelligenceSourceRole } from './brand-intelligence';

export type EditorialIdentityMatch =
  'VERIFIED' | 'PARTIALLY_VERIFIED' | 'INSUFFICIENT_EVIDENCE' | 'IDENTITY_MISMATCH';
export type EditorialSourceAuthority =
  'OFFICIAL_BRAND' | 'AUTHORIZED_DISTRIBUTOR' | 'TRUSTED_SECONDARY' | 'UNVERIFIED';
export type EditorialEvidenceClassification =
  | 'VERIFIED_INTERNAL'
  | 'VERIFIED_OFFICIAL_BRAND'
  | 'SUPPORTED_SECONDARY'
  | 'GENERAL_EDITORIAL_CONTEXT'
  | 'INSUFFICIENT_EVIDENCE';

/** Supplied by a trusted server registry, never by snippets, metadata or a model. */
export interface EditorialAuthorityRecord {
  readonly domain: string;
  readonly brandId: string;
  readonly brand: string;
  readonly role: BrandIntelligenceSourceRole;
  readonly verification: {
    readonly evidenceRef: string;
    readonly reason: string;
    readonly verifiedAt: string;
    readonly expiresAt: string;
  };
}
export interface EditorialResearchClaim {
  readonly id: string;
  readonly field: string;
  readonly claim: string;
  readonly classification: EditorialEvidenceClassification;
  readonly evidenceRefs: readonly string[];
  readonly sources: readonly string[];
  readonly confidence: Confidence;
  readonly usableInCopy: boolean;
}
export interface EditorialResearchSource {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly domain: string;
  readonly retrievedAt: string;
  readonly identityMatch: EditorialIdentityMatch;
  readonly authority: EditorialSourceAuthority;
  readonly authorityReason: string;
  readonly authorityEvidenceRef?: string;
  readonly extracts: readonly { readonly id: string; readonly text: string }[];
  readonly claims: readonly EditorialResearchClaim[];
  readonly rejectedClaims: readonly { readonly field: string; readonly reason: string }[];
}
export interface EditorialResearchReport {
  readonly identity: SearchProductIdentity;
  readonly status:
    | 'SEARCH_PROVIDER_NOT_CONFIGURED'
    | 'INSUFFICIENT_EVIDENCE'
    | 'COMPLETED'
    | 'PROVIDER_FAILED'
    | 'POLICY_BLOCKED';
  readonly evidenceStatus: 'SUPPORTED' | 'INSUFFICIENT_EVIDENCE';
  readonly query: string | null;
  readonly sources: readonly EditorialResearchSource[];
}
export interface EditorialResearchDependencies {
  readonly search?: SearchPort;
  readonly authorities?: readonly EditorialAuthorityRecord[];
  /** Operator-reviewed no-charge capability, not an estimated price or provider claim. */
  readonly freeOnly?: { readonly evidenceRef: string; readonly verifiedAt: string };
}

const normalized = (value: string) =>
  value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const validTime = (value: string) => Boolean(value?.trim()) && Number.isFinite(Date.parse(value));
export function editorialIdentityKey(identity: SearchProductIdentity): string {
  return JSON.stringify([
    identity.productId,
    identity.productName,
    identity.sku ?? '',
    identity.brandId ?? '',
    identity.brand ?? '',
    identity.category ?? '',
    Object.entries(identity.knownAttributes ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  ]);
}
export function buildEditorialSearchQuery(identity: SearchProductIdentity): string | null {
  if (
    ![
      identity.productId,
      identity.productName,
      identity.sku,
      identity.brandId,
      identity.brand,
    ].every((value) => value?.trim())
  )
    return null;
  // productId travels in expectedProductIdentity; internal identifiers are not public search terms.
  return [
    identity.productName,
    identity.brand!,
    identity.sku!,
    ...(identity.category ? [identity.category] : []),
    ...Object.entries(identity.knownAttributes ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}: ${value}`),
  ]
    .map((value) => JSON.stringify(value))
    .join(' ');
}
export function verifyEditorialSourceIdentity(
  expected: SearchProductIdentity,
  result: SearchResultItem,
): EditorialIdentityMatch {
  const data = result.productEvidence;
  if (!data || !buildEditorialSearchQuery(expected)) return 'INSUFFICIENT_EVIDENCE';
  const extracts = new Map(data.extracts.map((entry) => [entry.id, entry.text]));
  if (extracts.size !== data.extracts.length) return 'INSUFFICIENT_EVIDENCE';
  const checks: [string, SearchEvidenceValue | undefined][] = [
    [expected.productName, data.identity.productName],
    [expected.brand!, data.identity.brand],
    [expected.sku!, data.identity.sku],
    ...(expected.category
      ? [[expected.category, data.identity.category] as [string, SearchEvidenceValue | undefined]]
      : []),
    ...Object.entries(expected.knownAttributes ?? {}).map(
      ([key, value]): [string, SearchEvidenceValue | undefined] => [
        value,
        data.identity.knownAttributes?.[key],
      ],
    ),
  ];
  if (
    checks.some(
      ([value, actual]) => actual?.value?.trim() && normalized(value) !== normalized(actual.value),
    )
  )
    return 'IDENTITY_MISMATCH';
  const backed = checks.filter(
    ([value, actual]) =>
      actual &&
      normalized(value) === normalized(actual.value) &&
      Boolean(extracts.get(actual.evidenceRef)?.includes(actual.value)),
  );
  return backed.length === checks.length
    ? 'VERIFIED'
    : backed.length
      ? 'PARTIALLY_VERIFIED'
      : 'INSUFFICIENT_EVIDENCE';
}

function sourceAuthority(
  identity: SearchProductIdentity,
  domain: string,
  retrievedAt: string,
  records: readonly EditorialAuthorityRecord[],
) {
  const matching = records.filter(
    (record) =>
      normalized(record.domain) === domain &&
      record.brandId === identity.brandId &&
      normalized(record.brand) === normalized(identity.brand ?? '') &&
      record.verification.evidenceRef.trim() &&
      record.verification.reason.trim() &&
      validTime(record.verification.verifiedAt) &&
      validTime(record.verification.expiresAt) &&
      Date.parse(record.verification.verifiedAt) <= Date.parse(retrievedAt) &&
      Date.parse(record.verification.expiresAt) >= Date.parse(retrievedAt),
  );
  if (matching.length !== 1)
    return {
      authority: 'UNVERIFIED' as const,
      authorityReason: 'No unique, valid domain/brand authority evidence.',
    };
  const record = matching[0]!;
  const authorities: Record<BrandIntelligenceSourceRole, EditorialSourceAuthority> = {
    OFFICIAL_BRAND: 'OFFICIAL_BRAND',
    OFFICIAL_PRODUCT_COLLECTION: 'OFFICIAL_BRAND',
    AUTHORIZED_SUPPLIER: 'AUTHORIZED_DISTRIBUTOR',
    SECONDARY_REFERENCE: 'TRUSTED_SECONDARY',
  };
  return {
    authority: authorities[record.role] ?? 'UNVERIFIED',
    authorityReason: record.verification.reason,
    authorityEvidenceRef: record.verification.evidenceRef,
  };
}

const claimFields = new Set([
  'name',
  'brand',
  'category',
  'description',
  'attributes',
  'ingredients',
  'benefits',
  'results',
  'usage',
  'certifications',
  'dermatologicalProperties',
  'clinicalClaims',
  'origin',
  'composition',
  'presentation',
  'discounts',
  'availability',
]);
export function assessEditorialSearchResult(
  identity: SearchProductIdentity,
  result: SearchResultItem,
  records: readonly EditorialAuthorityRecord[] = [],
): EditorialResearchSource {
  const url = new URL(result.uri);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !result.title.trim())
    throw new Error('EDITORIAL_RESEARCH_SOURCE_INVALID');
  const data = result.productEvidence;
  if (
    !data ||
    !validTime(data.retrievedAt) ||
    data.domain.toLowerCase() !== url.hostname.toLowerCase() ||
    new Set(data.extracts.map((item) => item.id)).size !== data.extracts.length
  )
    throw new Error('EDITORIAL_RESEARCH_EVIDENCE_INVALID');
  const identityMatch = verifyEditorialSourceIdentity(identity, result);
  const authority = sourceAuthority(
    identity,
    url.hostname.toLowerCase(),
    data.retrievedAt,
    records,
  );
  const id = url.href;
  const claims: EditorialResearchClaim[] = [];
  const rejectedClaims: { field: string; reason: string }[] = [];
  for (const [index, claim] of data.claims.entries()) {
    // A snippet is discovery only. Every accepted claim is an exact full extract, not an LLM paraphrase.
    const supported =
      claim.evidenceRefs.length > 0 &&
      claim.evidenceRefs.every((ref) =>
        data.extracts.some(
          (extract) => extract.id === ref && extract.text.trim() === claim.value.trim(),
        ),
      );
    if (
      identityMatch !== 'VERIFIED' ||
      authority.authority === 'UNVERIFIED' ||
      !supported ||
      !claim.value.trim() ||
      !claimFields.has(claim.field)
    ) {
      rejectedClaims.push({
        field: claim.field,
        reason:
          identityMatch === 'IDENTITY_MISMATCH' ? 'IDENTITY_MISMATCH' : 'INSUFFICIENT_EVIDENCE',
      });
      continue;
    }
    const official = authority.authority === 'OFFICIAL_BRAND';
    claims.push({
      id: `${id}#claim-${index}`,
      field: claim.field,
      claim: claim.value,
      classification: official ? 'VERIFIED_OFFICIAL_BRAND' : 'SUPPORTED_SECONDARY',
      evidenceRefs: [...claim.evidenceRefs],
      sources: [id],
      confidence: {
        score: official ? 0.9 : 0.7,
        band: official ? 'VERY_HIGH' : 'HIGH',
        rationale: [
          'Exact product identity, verified source authority and verbatim extract; not clinical validation or execution authority.',
        ],
      },
      usableInCopy: official && !['discounts', 'availability'].includes(claim.field),
    });
  }
  return {
    id,
    title: result.title,
    url: url.href,
    domain: url.hostname.toLowerCase(),
    retrievedAt: data.retrievedAt,
    identityMatch,
    ...authority,
    extracts: data.extracts.map((entry) => ({ id: entry.id, text: entry.text })),
    claims,
    rejectedClaims,
  };
}

/** No adapter is created or selected here. Missing dependency means zero network calls/results. */
export async function researchEditorialProduct(
  identity: SearchProductIdentity,
  context: IntelligenceToolContext,
  dependencies: EditorialResearchDependencies = {},
): Promise<EditorialResearchReport> {
  const query = buildEditorialSearchQuery(identity);
  const empty = (status: EditorialResearchReport['status']): EditorialResearchReport => ({
    identity,
    query,
    status,
    evidenceStatus: 'INSUFFICIENT_EVIDENCE',
    sources: [],
  });
  if (!dependencies.search) return empty('SEARCH_PROVIDER_NOT_CONFIGURED');
  if (
    !query ||
    context.context.type !== 'PRODUCT' ||
    context.context.entityId !== identity.productId
  )
    return empty('INSUFFICIENT_EVIDENCE');
  if (
    dependencies.search.descriptor.kind !== 'SEARCH' ||
    !dependencies.search.descriptor.readOnly ||
    !dependencies.freeOnly?.evidenceRef.trim() ||
    !validTime(dependencies.freeOnly.verifiedAt)
  )
    return empty('POLICY_BLOCKED');
  try {
    const response = await dependencies.search.search({
      ...context,
      expectedProductIdentity: identity,
      costPolicy: 'FREE_ONLY',
      queries: [{ query, maxResults: 8 }],
    });
    if (response.trace?.usage?.costEstimate && response.trace.usage.costEstimate > 0)
      return empty('POLICY_BLOCKED');
    if (!['SUCCESS', 'PARTIAL', 'NO_RESULT'].includes(response.status))
      return empty('PROVIDER_FAILED');
    const sources = (response.data ?? [])
      .slice(0, 8)
      .flatMap((result) => {
        try {
          return [assessEditorialSearchResult(identity, result, dependencies.authorities)];
        } catch {
          return [];
        } // Malformed provider evidence cannot reach grounding.
      })
      .filter((source, index, all) => all.findIndex((other) => other.id === source.id) === index);
    return {
      identity,
      query,
      status: 'COMPLETED',
      evidenceStatus: sources.some((source) => source.claims.length)
        ? 'SUPPORTED'
        : 'INSUFFICIENT_EVIDENCE',
      sources,
    };
  } catch {
    return empty('PROVIDER_FAILED');
  }
}
