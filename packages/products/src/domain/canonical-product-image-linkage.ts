export const imageEvidenceRole = 'CATALOG_EVIDENCE_CROP' as const;
export const imageLinkageStatus = ['READY_LINKAGE', 'BLOCKED', 'SUPERSEDED'] as const;
export type ImageLinkageStatus = (typeof imageLinkageStatus)[number];
export const imageExclusionReasons = ['REJECT', 'DEFER'] as const;
export type ImageExclusionReason = (typeof imageExclusionReasons)[number];

export type CanonicalProductImageLinkage = {
  runId: string;
  sourceReferenceId: string;
  productId: string;
  productImageId: string;
  approvalSource: 'HUMAN_APPROVED' | 'POLICY_APPROVED';
  evidenceSha256: string;
  evidencePath: string;
  evidenceRole: typeof imageEvidenceRole;
  plannedWebBucket: 'lihen-product-web';
  plannedWebPath: string;
  originalUploadStatus: 'BLOCKED_EVIDENCE_IS_NOT_CANONICAL_ORIGINAL';
  linkageStatus: ImageLinkageStatus;
};

export function buildWebObjectPath(input: Pick<CanonicalProductImageLinkage, 'productId' | 'productImageId' | 'evidenceSha256'>): string {
  return `products/${input.productId}/${input.productImageId}/web/${input.evidenceSha256}.jpg`;
}
