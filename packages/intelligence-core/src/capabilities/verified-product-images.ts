import type {
  IntelligenceToolContext,
  SearchProductIdentity,
  SearchResultItem,
} from '../provider-ports';
import {
  assessEditorialSearchResult,
  buildEditorialSearchQuery,
  researchEditorialProduct,
  type EditorialResearchDependencies,
} from './editorial-research';

export const EXACT_IMAGE_ATTRIBUTES = [
  'manufacturer',
  'officialReference',
  'tone',
  'color',
  'size',
  'content',
  'presentation',
  'packaging',
] as const;
export type ExactImageMatch = 'EXACT_MATCH' | 'INSUFFICIENT_EVIDENCE' | 'IDENTITY_MISMATCH';
export type VerifiedImageStage =
  | 'CANDIDATE'
  | 'EXACT_IDENTITY_VERIFIED'
  | 'RIGHTS_VERIFIED'
  | 'HUMAN_APPROVED'
  | 'READY_FOR_CONTROLLED_SAVE';

/** Evidence must come from the existing governed server fetcher, never discovery metadata or a model.
 * The binding extract is JSON containing { imageUrl, productName, brand, attributes }.
 * It must describe this specific photograph, not a collection of unrelated product/gallery assets.
 */
export interface ProductPhotographEvidence {
  readonly imageUrl: string;
  readonly bindingEvidenceRef: string;
  readonly provenance: 'PHOTOGRAPH' | 'GENERATED' | 'UNKNOWN';
  readonly widthPx?: number;
  readonly heightPx?: number;
  /** Separate permission evidence, not implied by source-domain authority.
   * JSON extract: { imageUrl, commercialReuse: true, scope: 'LIHEN_CATALOG', expiresAt }.
   */
  readonly rightsEvidenceRef?: string;
}
export interface ProductPhotographResult extends SearchResultItem {
  readonly photographs?: readonly ProductPhotographEvidence[];
}
export interface VerifiedProductImage {
  readonly imageUrl: string;
  readonly sourceUrl: string;
  readonly sourceDomain: string;
  readonly checkedAt: string;
  readonly identity: SearchProductIdentity;
  readonly identityMatch: ExactImageMatch;
  readonly authority: string;
  readonly authorityEvidenceRef?: string;
  readonly authorityExpiresAt?: string;
  readonly evidence: readonly { readonly id: string; readonly text: string }[];
  readonly widthPx?: number;
  readonly heightPx?: number;
  readonly rightsStatus: 'RIGHTS_VERIFIED' | 'UNKNOWN';
  readonly rightsExpiresAt?: string;
  readonly stage: VerifiedImageStage;
  readonly reasons: readonly string[];
}

const normalized = (value: string) =>
  value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const unknownValues = new Set([
  'unknown',
  'desconocido',
  'desconocida',
  'sin asignar',
  'sin marca',
  'pendiente',
  'por confirmar',
  'n/a',
  'null',
]);
const known = (value: string | undefined) =>
  Boolean(value?.trim() && /[\p{L}\p{N}]/u.test(value) && !unknownValues.has(normalized(value)));
const time = (value: string | undefined) => (value?.trim() ? Date.parse(value) : NaN);
const safeUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
      ? url
      : null;
  } catch {
    return null;
  }
};
export function buildVerifiedImageQuery(identity: SearchProductIdentity): string | null {
  if (
    !known(identity.productName) ||
    !known(identity.brand) ||
    !EXACT_IMAGE_ATTRIBUTES.every((field) => known(identity.knownAttributes?.[field]))
  )
    return null;
  if (
    !identity.knownAttributes?.gtin?.trim() &&
    identity.knownAttributes?.identifierStatus !== 'NO_OFFICIAL_IDENTIFIER'
  )
    return null;
  return buildEditorialSearchQuery(identity);
}

const excludedDomain = (domain: string) =>
  /(^|\.)pinterest\.[a-z.]+$/.test(domain) ||
  ['pin.it', 'unsplash.com', 'pexels.com', 'shutterstock.com', 'gettyimages.com'].some(
    (blocked) => domain === blocked || domain.endsWith(`.${blocked}`),
  );

/** No fuzzy name reconciliation, confidence score, category or internal SKU can establish identity. */
export function assessProductPhotograph(
  identity: SearchProductIdentity,
  result: ProductPhotographResult,
  photograph: ProductPhotographEvidence,
  dependencies: Pick<EditorialResearchDependencies, 'authorities'>,
  checkedAt: string,
): VerifiedProductImage {
  const reasons: string[] = [];
  const page = safeUrl(result.uri);
  const asset = safeUrl(photograph.imageUrl);
  const extracts = result.productEvidence?.extracts ?? [];
  let match: ExactImageMatch = 'INSUFFICIENT_EVIDENCE';
  let authority = 'UNVERIFIED';
  let authorityEvidenceRef: string | undefined;
  let authorityExpiresAt = NaN;
  try {
    const assessed = assessEditorialSearchResult(identity, result, dependencies.authorities);
    authority = assessed.authority;
    authorityEvidenceRef = assessed.authorityEvidenceRef;
    authorityExpiresAt = time(
      dependencies.authorities?.find(
        (record) =>
          record.verification.evidenceRef === authorityEvidenceRef &&
          record.domain === page?.hostname,
      )?.verification.expiresAt,
    );
    if (assessed.identityMatch === 'IDENTITY_MISMATCH') match = 'IDENTITY_MISMATCH';
    if (assessed.identityMatch !== 'VERIFIED') reasons.push(assessed.identityMatch);
    if (
      !['OFFICIAL_BRAND', 'AUTHORIZED_DISTRIBUTOR'].includes(authority) ||
      !Number.isFinite(time(checkedAt)) ||
      !Number.isFinite(authorityExpiresAt) ||
      authorityExpiresAt <= time(checkedAt)
    ) {
      reasons.push('SOURCE_AUTHORITY_NOT_VERIFIED');
    }
  } catch {
    reasons.push('SOURCE_EVIDENCE_INVALID');
  }
  if (!buildVerifiedImageQuery(identity)) reasons.push('EXACT_REFERENCE_INCOMPLETE');
  if (
    identity.knownAttributes?.identifierStatus === 'NO_OFFICIAL_IDENTIFIER' &&
    result.productEvidence?.identity.knownAttributes?.gtin?.value?.trim()
  ) {
    match = 'IDENTITY_MISMATCH';
    reasons.push('OFFICIAL_IDENTIFIER_CONTRADICTION');
  }
  if (excludedDomain(page?.hostname ?? '') || excludedDomain(asset?.hostname ?? ''))
    reasons.push('EXCLUDED_IMAGE_SOURCE');
  if (!asset || !page || asset.hostname !== page.hostname)
    reasons.push('ASSET_DOMAIN_NOT_VERIFIED');
  if (photograph.provenance !== 'PHOTOGRAPH') reasons.push('PHOTOGRAPH_PROVENANCE_NOT_VERIFIED');
  if (
    !Number.isFinite(time(checkedAt)) ||
    time(result.productEvidence?.retrievedAt) > time(checkedAt)
  )
    reasons.push('CHECK_DATE_INVALID');
  try {
    const binding = JSON.parse(
      extracts.find((e) => e.id === photograph.bindingEvidenceRef)?.text ?? 'null',
    );
    if (!binding || binding.imageUrl !== photograph.imageUrl) throw new Error('NO_ASSET_BINDING');
    const checks: [string, unknown][] = [
      [identity.productName, binding.productName],
      [identity.brand ?? '', binding.brand],
      ...Object.entries(identity.knownAttributes ?? {}).map(([key, value]): [string, unknown] => [
        value,
        binding.attributes?.[key],
      ]),
    ];
    if (
      checks.some(
        ([expected, actual]) =>
          typeof actual === 'string' && normalized(actual) !== normalized(expected),
      )
    ) {
      match = 'IDENTITY_MISMATCH';
      reasons.push('PHOTOGRAPH_IDENTITY_MISMATCH');
    } else if (checks.some(([, actual]) => typeof actual !== 'string' || !actual.trim())) {
      reasons.push('PHOTOGRAPH_IDENTITY_INCOMPLETE');
    }
  } catch {
    reasons.push('PHOTOGRAPH_BINDING_MISSING');
  }
  if (match !== 'IDENTITY_MISMATCH' && reasons.length === 0) match = 'EXACT_MATCH';
  let rightsExpiresAt: string | undefined;
  try {
    const permission = JSON.parse(
      extracts.find((e) => e.id === photograph.rightsEvidenceRef)?.text ?? 'null',
    );
    if (
      match === 'EXACT_MATCH' &&
      permission?.imageUrl === photograph.imageUrl &&
      permission.commercialReuse === true &&
      permission.scope === 'LIHEN_CATALOG' &&
      time(permission.expiresAt) > time(checkedAt)
    )
      rightsExpiresAt = permission.expiresAt;
  } catch {
    /* Missing/malformed permission cannot grant commercial rights. */
  }
  if (!rightsExpiresAt) reasons.push('COMMERCIAL_RIGHTS_NOT_VERIFIED');
  return {
    imageUrl: photograph.imageUrl,
    sourceUrl: result.uri,
    sourceDomain: page?.hostname ?? '',
    checkedAt,
    identity,
    identityMatch: match,
    authority,
    ...(authorityEvidenceRef ? { authorityEvidenceRef } : {}),
    ...(Number.isFinite(authorityExpiresAt)
      ? { authorityExpiresAt: new Date(authorityExpiresAt).toISOString() }
      : {}),
    evidence: extracts,
    ...(photograph.widthPx !== undefined ? { widthPx: photograph.widthPx } : {}),
    ...(photograph.heightPx !== undefined ? { heightPx: photograph.heightPx } : {}),
    rightsStatus: rightsExpiresAt ? 'RIGHTS_VERIFIED' : 'UNKNOWN',
    ...(rightsExpiresAt ? { rightsExpiresAt } : {}),
    stage: rightsExpiresAt
      ? 'RIGHTS_VERIFIED'
      : match === 'EXACT_MATCH'
        ? 'EXACT_IDENTITY_VERIFIED'
        : 'CANDIDATE',
    reasons:
      match === 'EXACT_MATCH' ? ['EXACT_OFFICIAL_REFERENCE_AND_PHOTOGRAPH', ...reasons] : reasons,
  };
}

export interface ProductImageResearchDependencies extends EditorialResearchDependencies {
  /** Absent until the existing governed SearchPort can supply photograph-specific evidence. */
  readonly photographEvidenceSupported?: boolean;
}
export interface ProductImageResearchReport {
  readonly status:
    | 'SEARCH_PROVIDER_NOT_CONFIGURED'
    | 'INSUFFICIENT_EVIDENCE'
    | 'COMPLETED'
    | 'PROVIDER_FAILED'
    | 'POLICY_BLOCKED';
  readonly query: string | null;
  readonly candidates: readonly VerifiedProductImage[];
  readonly rejected: readonly VerifiedProductImage[];
}
export async function researchVerifiedProductImages(
  identity: SearchProductIdentity,
  context: IntelligenceToolContext,
  dependencies: ProductImageResearchDependencies = {},
  checkedAt = new Date().toISOString(),
): Promise<ProductImageResearchReport> {
  const query = buildVerifiedImageQuery(identity);
  const empty = (status: ProductImageResearchReport['status']): ProductImageResearchReport => ({
    status,
    query,
    candidates: [],
    rejected: [],
  });
  if (!query) return empty('INSUFFICIENT_EVIDENCE');
  if (!dependencies.search || !dependencies.photographEvidenceSupported)
    return empty('SEARCH_PROVIDER_NOT_CONFIGURED');
  // Reuse the existing governed orchestration, cost policy and authority registry. No second search adapter.
  const collected: ProductPhotographResult[] = [];
  const upstream = dependencies.search;
  const report = await researchEditorialProduct(identity, context, {
    ...dependencies,
    search: {
      descriptor: upstream.descriptor,
      async search(request) {
        const domains = [
          ...new Set(
            (dependencies.authorities ?? [])
              .filter(
                (record) =>
                  record.brandId === identity.brandId &&
                  normalized(record.brand) === normalized(identity.brand ?? '') &&
                  ['OFFICIAL_BRAND', 'OFFICIAL_PRODUCT_COLLECTION', 'AUTHORIZED_SUPPLIER'].includes(
                    record.role,
                  ) &&
                  time(record.verification.verifiedAt) <= time(checkedAt) &&
                  time(record.verification.expiresAt) > time(checkedAt) &&
                  record.verification.reason.trim() &&
                  record.verification.evidenceRef.trim() &&
                  !excludedDomain(record.domain),
              )
              .map((record) => record.domain),
          ),
        ];
        if (!domains.length) return { status: 'NO_RESULT', messages: [], data: [] };
        const response = await upstream.search({
          ...request,
          queries: request.queries.map((item) => ({ ...item, domains })),
        });
        collected.push(...(response.data ?? []));
        return response;
      },
    },
  });
  if (report.status !== 'COMPLETED') return empty(report.status);
  let evaluated: VerifiedProductImage[];
  try {
    evaluated = collected
      .slice(0, 8)
      .flatMap((result) =>
        (result.photographs ?? [])
          .slice(0, 10)
          .map((photo) =>
            assessProductPhotograph(identity, result, photo, dependencies, checkedAt),
          ),
      );
  } catch {
    return empty('PROVIDER_FAILED');
  }
  const unique = evaluated.filter(
    (item, index, all) => all.findIndex((other) => other.imageUrl === item.imageUrl) === index,
  );
  return {
    status: 'COMPLETED',
    query,
    candidates: unique.filter((item) => item.identityMatch === 'EXACT_MATCH').slice(0, 5),
    rejected: unique.filter((item) => item.identityMatch !== 'EXACT_MATCH'),
  };
}

/** Informational local review only. It cannot issue READY_FOR_CONTROLLED_SAVE: the current server
 * has no external-image authorization/ingestion verifier at the Storage/RPC write boundary. */
export function reviewProductPhotograph(
  image: VerifiedProductImage,
  authorized: boolean,
  humanApproved: boolean,
  now: string,
): VerifiedImageStage {
  if (image.identityMatch !== 'EXACT_MATCH') return 'CANDIDATE';
  if (!(time(image.authorityExpiresAt) > time(now))) return 'CANDIDATE';
  if (image.rightsStatus !== 'RIGHTS_VERIFIED' || !(time(image.rightsExpiresAt) > time(now)))
    return 'EXACT_IDENTITY_VERIFIED';
  if (!authorized || !humanApproved) return 'RIGHTS_VERIFIED';
  return 'HUMAN_APPROVED';
}
