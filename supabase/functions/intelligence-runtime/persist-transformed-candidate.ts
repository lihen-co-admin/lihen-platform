import type { SupabaseClient } from 'supabase';

const REVIEW_BUCKET = 'lihen-intelligence-review';

export interface PersistTransformedCandidateInput {
  readonly requestId: string;
  readonly correlationId: string;
  readonly productId: string;
  readonly productImageId: string;
  readonly createdBy: string;
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly sha256: string;
  readonly intendedUse: string;
  readonly constraints: readonly string[];
}

export interface PersistTransformedCandidateResult {
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly transformedRef: string;
}

export async function persistTransformedCandidate(
  client: SupabaseClient,
  input: PersistTransformedCandidateInput,
): Promise<PersistTransformedCandidateResult> {
  if (input.mimeType !== 'image/png') {
    throw new Error(
      `LIHEN_TRANSFORMED_MIME_NOT_ALLOWED:${input.mimeType}`,
    );
  }

  const storagePath = [
    'image-transformations',
    input.productId,
    input.requestId,
    input.productImageId,
    'remove-background.png',
  ].join('/');

  const { error: uploadError } = await client.storage
    .from(REVIEW_BUCKET)
    .upload(
      storagePath,
      input.bytes,
      {
        contentType: input.mimeType,
        upsert: false,
      },
    );

  if (uploadError) {
    throw new Error(
      `LIHEN_TRANSFORMATION_REVIEW_UPLOAD_FAILED:${uploadError.message}`,
    );
  }

  const { data: persistedRows, error: insertError } =
    await client.rpc(
      'persist_intelligence_image_transformation_candidate',
      {
        p_request_id: input.requestId,
        p_correlation_id: input.correlationId,
        p_product_id: input.productId,
        p_source_product_image_id: input.productImageId,
        p_storage_bucket: REVIEW_BUCKET,
        p_storage_path: storagePath,
        p_mime_type: input.mimeType,
        p_sha256: input.sha256,
        p_provider_name: 'remove.bg',
        p_intended_use: input.intendedUse,
        p_constraints: [...input.constraints],
        p_created_by: input.createdBy,
      },
    );

  if (insertError) {
    await client.storage
      .from(REVIEW_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);

    throw new Error(
      `LIHEN_TRANSFORMATION_REVIEW_INSERT_FAILED:${insertError.message}`,
    );
  }

  if (
    !Array.isArray(persistedRows)
    || persistedRows.length !== 1
    || persistedRows[0]?.status !== 'PENDING_REVIEW'
  ) {
    await client.storage
      .from(REVIEW_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);

    throw new Error(
      'LIHEN_TRANSFORMATION_REVIEW_PERSISTENCE_INVALID_RESULT',
    );
  }

  return {
    storageBucket: REVIEW_BUCKET,
    storagePath,
    transformedRef: `storage://${REVIEW_BUCKET}/${storagePath}`,
  };
}
