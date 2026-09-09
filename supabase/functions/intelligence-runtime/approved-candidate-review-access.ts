import type { SupabaseClient } from 'supabase';

const SIGNED_URL_TTL_SECONDS = 300;

interface ApprovedCatalogPdfCandidateRow {
  readonly candidate_id: string;
  readonly product_id: string;
  readonly source_product_image_id: string;
  readonly source_id: string;
  readonly review_bucket: string;
  readonly review_path: string;
  readonly review_mime_type: string;
  readonly intended_use: string;
  readonly provider_name: string;
  readonly source_derivative_profile: string | null;
  readonly source_image_status: string;
}

export interface ApprovedCandidateReviewAccessResult {
  readonly candidateId: string;
  readonly productId: string;
  readonly sourceProductImageId: string;
  readonly sourceId: string;
  readonly reviewBucket: string;
  readonly reviewPath: string;
  readonly mimeType: string;
  readonly providerName: string;
  readonly signedUrl: string;
  readonly expiresInSeconds: number;
}

export async function createApprovedCandidateReviewAccess(
  client: SupabaseClient,
  candidateId: string,
): Promise<ApprovedCandidateReviewAccessResult> {
  const normalizedCandidateId = candidateId.trim();

  if (!normalizedCandidateId) {
    throw new Error('LIHEN_CATALOG_PDF_CANDIDATE_ID_REQUIRED');
  }

  const { data, error } = await client.rpc(
    'get_catalog_pdf_approved_candidate',
    {
      p_candidate_id: normalizedCandidateId,
    },
  );

  if (error) {
    throw new Error(
      `LIHEN_CATALOG_PDF_CANDIDATE_READ_FAILED:${error.message}`,
    );
  }

  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error(
      'LIHEN_CATALOG_PDF_CANDIDATE_READ_INVALID_RESULT',
    );
  }

  const row = data[0] as ApprovedCatalogPdfCandidateRow;

  if (
    row.review_bucket !== 'lihen-intelligence-review'
    || row.review_mime_type !== 'image/png'
    || row.intended_use !== 'CATALOG_PDF'
    || row.source_image_status !== 'ACTIVE'
  ) {
    throw new Error(
      'LIHEN_CATALOG_PDF_CANDIDATE_REVIEW_CONTRACT_INVALID',
    );
  }

  const { data: signed, error: signedError } = await client.storage
    .from(row.review_bucket)
    .createSignedUrl(
      row.review_path,
      SIGNED_URL_TTL_SECONDS,
    );

  if (signedError || !signed?.signedUrl) {
    throw new Error(
      `LIHEN_CATALOG_PDF_REVIEW_SIGNED_URL_FAILED:${
        signedError?.message ?? 'SIGNED_URL_MISSING'
      }`,
    );
  }

  return {
    candidateId: row.candidate_id,
    productId: row.product_id,
    sourceProductImageId: row.source_product_image_id,
    sourceId: row.source_id,
    reviewBucket: row.review_bucket,
    reviewPath: row.review_path,
    mimeType: row.review_mime_type,
    providerName: row.provider_name,
    signedUrl: signed.signedUrl,
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
  };
}
