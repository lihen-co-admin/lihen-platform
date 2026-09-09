import type { SupabaseClient } from 'supabase';
import {
  createApprovedCandidateReviewAccess,
} from './approved-candidate-review-access.ts';
import {
  convertApprovedPngToCatalogPdfWebp,
} from './catalog-pdf-webp-transformer.ts';

const WEB_BUCKET = 'lihen-product-web';
const WEB_MAX_BYTES = 3 * 1024 * 1024;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export interface PromoteCatalogPdfCandidateResult {
  readonly candidateId: string;
  readonly productImageId: string;
  readonly productId: string;
  readonly sourceId: string;
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly publicUrl: string;
  readonly mimeType: 'image/webp';
  readonly byteSize: number;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
  readonly replayed: boolean;
}

export async function promoteApprovedCandidateToCatalogPdf(
  client: SupabaseClient,
  candidateId: string,
): Promise<PromoteCatalogPdfCandidateResult> {
  const context =
    await createApprovedCandidateReviewAccess(
      client,
      candidateId,
    );

  const { data: sourceBlob, error: sourceError } =
    await client.storage
      .from(context.reviewBucket)
      .download(context.reviewPath);

  if (sourceError || !sourceBlob) {
    throw new Error(
      `LIHEN_CATALOG_PDF_REVIEW_DOWNLOAD_FAILED:${
        sourceError?.message ?? 'SOURCE_MISSING'
      }`,
    );
  }

  const sourceBytes = new Uint8Array(
    await sourceBlob.arrayBuffer(),
  );

  const webp =
    convertApprovedPngToCatalogPdfWebp(sourceBytes);

  const byteSize = webp.bytes.byteLength;

  if (byteSize <= 0 || byteSize > WEB_MAX_BYTES) {
    throw new Error(
      `LIHEN_CATALOG_PDF_WEBP_SIZE_INVALID:${byteSize}`,
    );
  }

  const sha256 = await sha256Hex(webp.bytes);

  const productImageId = context.candidateId;

  const storagePath = [
    'products',
    context.productId,
    productImageId,
    'web',
    `${sha256}.webp`,
  ].join('/');

  const bucket = client.storage.from(WEB_BUCKET);

  const { error: uploadError } = await bucket.upload(
    storagePath,
    webp.bytes,
    {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    },
  );

  if (uploadError) {
    const { data: existingBlob, error: existingError } =
      await bucket.download(storagePath);

    if (existingError || !existingBlob) {
      throw new Error(
        `LIHEN_CATALOG_PDF_WEBP_UPLOAD_FAILED:${uploadError.message}`,
      );
    }

    const existingBytes = new Uint8Array(
      await existingBlob.arrayBuffer(),
    );

    const existingSha256 =
      await sha256Hex(existingBytes);

    if (
      existingBytes.byteLength !== byteSize
      || existingSha256 !== sha256
    ) {
      throw new Error(
        'LIHEN_CATALOG_PDF_WEBP_EXISTING_OBJECT_CONFLICT',
      );
    }
  }

  const { data: publicData } =
    bucket.getPublicUrl(storagePath);

  if (!publicData.publicUrl) {
    throw new Error(
      'LIHEN_CATALOG_PDF_PUBLIC_URL_MISSING',
    );
  }

  const operationKey =
    `catalog-pdf:${context.candidateId}:${sha256}`;

  const { data: finalized, error: finalizeError } =
    await client.rpc(
      'finalize_catalog_pdf_image_storage',
      {
        p_operation_key: operationKey,
        p_product_image_id: productImageId,
        p_product_id: context.productId,
        p_source_id: context.sourceId,
        p_bucket_id: WEB_BUCKET,
        p_object_path: storagePath,
        p_public_url: publicData.publicUrl,
        p_mime_type: 'image/webp',
        p_byte_size: byteSize,
        p_sha256: sha256,
        p_width_px: webp.width,
        p_height_px: webp.height,
      },
    );

  if (finalizeError) {
    throw new Error(
      `LIHEN_CATALOG_PDF_FINALIZE_FAILED:${finalizeError.message}`,
    );
  }

  if (
    !Array.isArray(finalized)
    || finalized.length !== 1
  ) {
    throw new Error(
      'LIHEN_CATALOG_PDF_FINALIZE_INVALID_RESULT',
    );
  }

  const row = finalized[0] as {
    product_image_id: string;
    product_id: string;
    source_id: string;
    storage_bucket: string;
    storage_path: string;
    public_url: string;
    replayed: boolean;
  };

  return {
    candidateId: context.candidateId,
    productImageId: row.product_image_id,
    productId: row.product_id,
    sourceId: row.source_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    mimeType: 'image/webp',
    byteSize,
    sha256,
    width: webp.width,
    height: webp.height,
    replayed: Boolean(row.replayed),
  };
}
