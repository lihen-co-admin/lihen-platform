import type { EditorialAuthorityRecord } from '../../../../packages/intelligence-core/src/capabilities/editorial-research.ts';
import type { BrandIntelligenceSourceRole } from '../../../../packages/intelligence-core/src/capabilities/brand-intelligence.ts';

const roles = new Set<BrandIntelligenceSourceRole>([
  'OFFICIAL_BRAND',
  'OFFICIAL_PRODUCT_COLLECTION',
  'AUTHORIZED_SUPPLIER',
  'SECONDARY_REFERENCE',
]);

function validTime(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseRecord(value: unknown): EditorialAuthorityRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  const verification =
    record.verification &&
    typeof record.verification === 'object' &&
    !Array.isArray(record.verification)
      ? (record.verification as Record<string, unknown>)
      : undefined;

  if (
    !nonEmpty(record.domain) ||
    !nonEmpty(record.brandId) ||
    !nonEmpty(record.brand) ||
    !nonEmpty(record.role) ||
    !roles.has(record.role as BrandIntelligenceSourceRole) ||
    !verification ||
    !nonEmpty(verification.evidenceRef) ||
    !nonEmpty(verification.reason) ||
    !validTime(verification.verifiedAt) ||
    !validTime(verification.expiresAt)
  ) {
    return undefined;
  }

  if (Date.parse(verification.verifiedAt) > Date.parse(verification.expiresAt)) {
    return undefined;
  }

  return {
    domain: record.domain.trim().toLowerCase(),
    brandId: record.brandId.trim(),
    brand: record.brand.trim(),
    role: record.role as BrandIntelligenceSourceRole,
    verification: {
      evidenceRef: verification.evidenceRef.trim(),
      reason: verification.reason.trim(),
      verifiedAt: verification.verifiedAt.trim(),
      expiresAt: verification.expiresAt.trim(),
    },
  };
}

export function parseEditorialAuthorityRegistry(
  raw: string | undefined,
): readonly EditorialAuthorityRecord[] {
  if (!raw?.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    const records = parsed.map(parseRecord);

    // Fail closed for the entire registry: one malformed entry invalidates all authority.
    if (records.some((record) => !record)) return [];

    const valid = records as EditorialAuthorityRecord[];
    const keys = valid.map(
      (record) =>
        `${record.domain}\u0000${record.brandId}\u0000${record.brand.toLocaleLowerCase()}`,
    );

    // Ambiguous duplicate authority must never be accepted.
    if (new Set(keys).size !== keys.length) return [];

    return valid;
  } catch {
    return [];
  }
}
