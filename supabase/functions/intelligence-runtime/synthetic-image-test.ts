import type { ServerImageEvidence } from './external-image-verification.ts';

export const SYNTHETIC_PROJECT_URL = 'https://vnmkupzptujtywnnabkp.supabase.co';
export const SYNTHETIC_PRODUCT_ID = '8ebc8ca4-7c42-4e85-b42c-fbb218327101';
export const SYNTHETIC_SKU = 'SYNTHETIC-WEBP-DEV-20261017-01';
// SHA-256 read from the prepared 600x600 PNG, not a placeholder or caller input.
export const SYNTHETIC_SOURCE_SHA256 =
  '8a2364c06d4a91acf5a65329a5f4a4701cbf911fab22c24d55202f69f1c294a6';
export const SYNTHETIC_MAX_AGE_MS = 30 * 60 * 1000;

export function validateSyntheticTest(
  evidence: ServerImageEvidence,
  projectUrl: string | undefined,
  now: number,
): void {
  const s = evidence.synthetic;
  const approvedAt = Date.parse(s?.approvedAt ?? '');
  const expiresAt = Date.parse(evidence.approval.expiresAt);
  if (
    projectUrl !== SYNTHETIC_PROJECT_URL ||
    evidence.mode !== 'SYNTHETIC_TEST' ||
    evidence.binding.productId !== SYNTHETIC_PRODUCT_ID ||
    evidence.binding.sku !== SYNTHETIC_SKU ||
    evidence.binding.sourceSha256 !== SYNTHETIC_SOURCE_SHA256 ||
    !s?.provenanceDocumentId?.trim() ||
    s.provenanceDocumentId !== evidence.rights.documentId ||
    !/^[a-f0-9]{64}$/.test(s.documentSha256) ||
    s.humanTestApproval !== true ||
    !Number.isFinite(approvedAt) ||
    approvedAt > now ||
    now - approvedAt > SYNTHETIC_MAX_AGE_MS ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    expiresAt > approvedAt + SYNTHETIC_MAX_AGE_MS ||
    evidence.rights.commercialUse !== false ||
    evidence.authenticPhotographEvidenceId ||
    evidence.exactIdentityEvidenceId
  )
    throw new Error('EXTERNAL_IMAGE_SYNTHETIC_TEST_INVALID');
}
