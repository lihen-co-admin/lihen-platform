import type { ProductImage } from './product-image';

export type ProductAssetProvenanceSourceType =
  | 'ORIGINAL'
  | 'OFFICIAL_WEB'
  | 'SUPPLIER_PDF'
  | 'SUPPLIER_DRIVE'
  | 'CATALOG_EVIDENCE_CROP'
  | 'VERIFIED_EXTERNAL'
  | 'HUMAN_PROVIDED';

export type ProductAssetProvenanceReviewStatus =
  | 'PENDING'
  | 'EVIDENCE_ACCEPTED'
  | 'HUMAN_APPROVED'
  | 'REJECTED';

export type ProductAssetPublicationEligibility =
  | 'NOT_ELIGIBLE'
  | 'FALLBACK_ONLY'
  | 'ELIGIBLE_PRIMARY';

export type ProductAssetSourceAvailabilityStatus =
  | 'UNKNOWN'
  | 'AVAILABLE'
  | 'MISSING'
  | 'CHANGED';

export type ProductAssetProvenanceMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

export interface ProductAssetProvenanceProps {
  readonly id: string;
  readonly productId: string;
  readonly sourceType: ProductAssetProvenanceSourceType;
  readonly sha256: string;
  readonly mimeType: ProductAssetProvenanceMimeType;
  readonly sourceReferenceId?: string;
  readonly sourceDocumentKey?: string;
  readonly sourcePage?: number;
  readonly sourceUrl?: string;
  readonly supplierReference?: string;
  readonly brandId?: string;
  readonly capturedAt?: string;
  readonly widthPx?: number;
  readonly heightPx?: number;
  readonly byteSize?: number;
  readonly qualityScore?: number;
  readonly confidenceScore?: number;
  readonly isExactProductMatch?: boolean;
  readonly requiresReview?: boolean;
  readonly reviewStatus?: ProductAssetProvenanceReviewStatus;
  readonly publicationEligibility?: ProductAssetPublicationEligibility;
  readonly sourceAvailabilityStatus?: ProductAssetSourceAvailabilityStatus;
  readonly lastSourceCheckAt?: string;
  readonly sourceChangeDetected?: boolean;
}

export class ProductAssetProvenance {
  public readonly id: string;
  public readonly productId: string;
  public readonly sourceType: ProductAssetProvenanceSourceType;
  public readonly sha256: string;
  public readonly mimeType: ProductAssetProvenanceMimeType;
  public readonly sourceReferenceId: string | undefined;
  public readonly sourceDocumentKey: string | undefined;
  public readonly sourcePage: number | undefined;
  public readonly sourceUrl: string | undefined;
  public readonly supplierReference: string | undefined;
  public readonly brandId: string | undefined;
  public readonly capturedAt: string | undefined;
  public readonly widthPx: number | undefined;
  public readonly heightPx: number | undefined;
  public readonly byteSize: number | undefined;
  public readonly qualityScore: number | undefined;
  public readonly confidenceScore: number | undefined;
  public readonly isExactProductMatch: boolean;
  public readonly requiresReview: boolean;
  public readonly reviewStatus: ProductAssetProvenanceReviewStatus;
  public readonly publicationEligibility: ProductAssetPublicationEligibility;
  public readonly sourceAvailabilityStatus: ProductAssetSourceAvailabilityStatus;
  public readonly lastSourceCheckAt: string | undefined;
  public readonly sourceChangeDetected: boolean;

  public constructor(props: ProductAssetProvenanceProps) {
    const id = props.id.trim();
    const productId = props.productId.trim();
    const sha256 = props.sha256.trim();

    if (!id) throw new Error('Product asset provenance id is required.');
    if (!productId) {
      throw new Error('Product asset provenance productId is required.');
    }
    if (!/^[0-9a-f]{64}$/.test(sha256)) {
      throw new Error('Product asset provenance sha256 must be lowercase 64-char hex.');
    }

    validatePositiveInteger('sourcePage', props.sourcePage);
    validatePositiveInteger('widthPx', props.widthPx);
    validatePositiveInteger('heightPx', props.heightPx);
    validatePositiveInteger('byteSize', props.byteSize);
    validateScore('qualityScore', props.qualityScore);
    validateScore('confidenceScore', props.confidenceScore);

    const isExactProductMatch = props.isExactProductMatch ?? false;
    const requiresReview = props.requiresReview ?? true;
    const reviewStatus = props.reviewStatus ?? 'PENDING';

    if (
      reviewStatus === 'HUMAN_APPROVED'
      && (!isExactProductMatch || requiresReview)
    ) {
      throw new Error(
        'HUMAN_APPROVED provenance requires exact product match and no pending review.',
      );
    }

    this.id = id;
    this.productId = productId;
    this.sourceType = props.sourceType;
    this.sha256 = sha256;
    this.mimeType = props.mimeType;
    this.sourceReferenceId = cleanOptional(props.sourceReferenceId);
    this.sourceDocumentKey = cleanOptional(props.sourceDocumentKey);
    this.sourcePage = props.sourcePage;
    this.sourceUrl = cleanOptional(props.sourceUrl);
    this.supplierReference = cleanOptional(props.supplierReference);
    this.brandId = cleanOptional(props.brandId);
    this.capturedAt = cleanOptional(props.capturedAt);
    this.widthPx = props.widthPx;
    this.heightPx = props.heightPx;
    this.byteSize = props.byteSize;
    this.qualityScore = props.qualityScore;
    this.confidenceScore = props.confidenceScore;
    this.isExactProductMatch = isExactProductMatch;
    this.requiresReview = requiresReview;
    this.reviewStatus = reviewStatus;
    this.publicationEligibility =
      props.publicationEligibility ?? 'NOT_ELIGIBLE';
    this.sourceAvailabilityStatus =
      props.sourceAvailabilityStatus ?? 'UNKNOWN';
    this.lastSourceCheckAt = cleanOptional(props.lastSourceCheckAt);
    this.sourceChangeDetected = props.sourceChangeDetected ?? false;
  }
}

/**
 * Verifies the existing physical relationship:
 * public.product_images.source_id -> lihen_private.product_image_sources.id.
 *
 * Provenance describes evidence/origin. It does not select PDF/Web channel assets.
 */
export function assertProductAssetProvenanceLink(
  asset: ProductImage,
  provenance: ProductAssetProvenance,
): void {
  if (asset.productId !== provenance.productId) {
    throw new Error('Product asset and provenance must belong to the same productId.');
  }
  if (!asset.sourceId) {
    throw new Error('Product asset must reference provenance through sourceId.');
  }
  if (asset.sourceId !== provenance.id) {
    throw new Error('Product asset sourceId must match provenance id.');
  }
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function validatePositiveInteger(
  field: string,
  value: number | undefined,
): void {
  if (
    value !== undefined
    && (!Number.isInteger(value) || value <= 0)
  ) {
    throw new Error(`Product asset provenance ${field} must be a positive integer.`);
  }
}

function validateScore(field: string, value: number | undefined): void {
  if (
    value !== undefined
    && (!Number.isFinite(value) || value < 0 || value > 100)
  ) {
    throw new Error(`Product asset provenance ${field} must be between 0 and 100.`);
  }
}
