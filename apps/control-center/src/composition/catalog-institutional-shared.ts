export const SHARED_INSTITUTIONAL_BACKBONE = {
  mode: 'SINGLE_SOURCE_SHARED_SNAPSHOT',
  pages: [1, 2, 3, 4, 'FINAL'],
  consumers: ['ALL', 'BEAUTY_CARE', 'STYLE'],
  source: 'catalogInstitutionalComposition.getSnapshot(versionId)',
  invariants: {
    sameSnapshotAcrossBusinessLines: true,
    sameInstitutionalImagesAcrossBusinessLines: true,
    samePaymentMethodsAcrossBusinessLines: true,
    sameChannelQrsAcrossBusinessLines: true,
    noStyleSpecificInstitutionalOverride: true,
    noBeautyCareSpecificInstitutionalOverride: true,
  },
} as const;

export type SharedInstitutionalPage =
  (typeof SHARED_INSTITUTIONAL_BACKBONE.pages)[number];

export function isSharedInstitutionalPage(
  page: number | 'FINAL',
): page is SharedInstitutionalPage {
  return SHARED_INSTITUTIONAL_BACKBONE.pages.includes(
    page as SharedInstitutionalPage,
  );
}
