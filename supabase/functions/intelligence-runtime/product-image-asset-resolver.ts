interface SupabaseRpcResult {
  readonly data: unknown;
  readonly error: { readonly message?: string } | null;
}

interface SupabaseRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<SupabaseRpcResult>;
}

export interface ResolvedProductImageAsset {
  readonly productId: string;
  readonly productImageId: string;
  readonly publicUrl: string;
  readonly storageBucket?: string;
  readonly storagePath?: string;
  readonly sourceType: string;
}

interface ProductImageRpcRow {
  readonly id: unknown;
  readonly product_id: unknown;
  readonly public_url: unknown;
  readonly storage_bucket?: unknown;
  readonly storage_path?: unknown;
  readonly source_type: unknown;
  readonly status: unknown;
}

export async function resolveAuthorizedProductImageAsset(
  client: SupabaseRpcClient,
  input: {
    readonly productId: string;
    readonly productImageId: string;
  },
): Promise<ResolvedProductImageAsset> {
  const productId = input.productId.trim();
  const productImageId = input.productImageId.trim();

  if (!productId) {
    throw new Error('LIHEN_PRODUCT_ID_REQUIRED');
  }

  if (!productImageId) {
    throw new Error('LIHEN_PRODUCT_IMAGE_ID_REQUIRED');
  }

  const { data, error } = await client.rpc(
    'get_product_images',
    {
      p_product_id: productId,
    },
  );

  if (error) {
    throw new Error(
      `LIHEN_PRODUCT_IMAGE_RESOLUTION_FAILED:${error.message ?? 'UNKNOWN'}`,
    );
  }

  const rows = Array.isArray(data)
    ? data as ProductImageRpcRow[]
    : [];

  const row = rows.find(
    (candidate) =>
      String(candidate.id) === productImageId
      && String(candidate.product_id) === productId
      && String(candidate.status) === 'ACTIVE',
  );

  if (!row) {
    throw new Error('LIHEN_PRODUCT_IMAGE_NOT_AUTHORIZED_OR_NOT_FOUND');
  }

  const publicUrl = String(row.public_url ?? '').trim();

  if (!publicUrl) {
    throw new Error('LIHEN_PRODUCT_IMAGE_SOURCE_UNAVAILABLE');
  }

  return {
    productId,
    productImageId,
    publicUrl,
    ...(row.storage_bucket
      ? { storageBucket: String(row.storage_bucket) }
      : {}),
    ...(row.storage_path
      ? { storagePath: String(row.storage_path) }
      : {}),
    sourceType: String(row.source_type),
  };
}

export async function fetchResolvedProductImageBytes(
  asset: ResolvedProductImageAsset,
): Promise<{
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}> {
  const response = await fetch(asset.publicUrl);

  if (!response.ok) {
    throw new Error(
      `LIHEN_PRODUCT_IMAGE_FETCH_FAILED:${response.status}`,
    );
  }

  const mimeType =
    response.headers.get('content-type')
      ?.split(';')[0]
      ?.trim()
    || 'application/octet-stream';

  if (
    mimeType !== 'image/jpeg'
    && mimeType !== 'image/png'
    && mimeType !== 'image/webp'
  ) {
    throw new Error(
      `LIHEN_PRODUCT_IMAGE_MIME_NOT_ALLOWED:${mimeType}`,
    );
  }

  const bytes = new Uint8Array(
    await response.arrayBuffer(),
  );

  if (bytes.byteLength === 0) {
    throw new Error('LIHEN_PRODUCT_IMAGE_EMPTY');
  }

  return {
    bytes,
    mimeType,
  };
}
