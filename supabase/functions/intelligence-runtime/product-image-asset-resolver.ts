interface SupabaseRpcResult {
  readonly data: unknown;
  readonly error: { readonly message?: string } | null;
}

/** Server-side security allowlist, independent of client-supplied labels. */
export function isProductVisionPilot(product: { id: string; sku?: string | null | undefined }) {
  return (
    (product.id === 'd519d93f-04ee-e454-3461-f11ce9ac19f1' && product.sku === 'BC-20550') ||
    (product.id === '9969ebfc-d7ff-475f-a031-65adc671e34e' && product.sku === 'ST-019')
  );
}

interface SupabaseRpcClient {
  rpc(functionName: string, args: Record<string, unknown>): PromiseLike<SupabaseRpcResult>;
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

  const { data, error } = await client.rpc('get_product_images', {
    p_product_id: productId,
  });

  if (error) {
    throw new Error(`LIHEN_PRODUCT_IMAGE_RESOLUTION_FAILED:${error.message ?? 'UNKNOWN'}`);
  }

  const rows = Array.isArray(data) ? (data as ProductImageRpcRow[]) : [];

  const row = rows.find(
    (candidate) =>
      String(candidate.id) === productImageId &&
      String(candidate.product_id) === productId &&
      String(candidate.status) === 'ACTIVE',
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
    ...(row.storage_bucket ? { storageBucket: String(row.storage_bucket) } : {}),
    ...(row.storage_path ? { storagePath: String(row.storage_path) } : {}),
    sourceType: String(row.source_type),
  };
}

export async function fetchResolvedProductImageBytes(
  asset: ResolvedProductImageAsset,
  options: { fetchImpl?: typeof fetch; maxBytes?: number } = {},
): Promise<{
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}> {
  const response = await (options.fetchImpl ?? fetch)(asset.publicUrl);

  if (!response.ok) {
    throw new Error(`LIHEN_PRODUCT_IMAGE_FETCH_FAILED:${response.status}`);
  }

  const mimeType =
    response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';

  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/webp') {
    throw new Error(`LIHEN_PRODUCT_IMAGE_MIME_NOT_ALLOWED:${mimeType}`);
  }

  let bytes: Uint8Array;
  if (options.maxBytes !== undefined) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('LIHEN_PRODUCT_IMAGE_EMPTY');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > options.maxBytes) throw new Error('VISION_IMAGE_SIZE_LIMIT');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
  } else {
    bytes = new Uint8Array(await response.arrayBuffer());
  }

  if (bytes.byteLength === 0) {
    throw new Error('LIHEN_PRODUCT_IMAGE_EMPTY');
  }

  return {
    bytes,
    mimeType,
  };
}

/** Reuses authenticated resolution. No caller-supplied bytes or URLs establish a DEV binding. */
export async function prepareProductVisionAsset(
  client: SupabaseRpcClient,
  input: { productId: string; productImageId: string },
  fetchImpl: typeof fetch = fetch,
) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(input.productId) || !uuid.test(input.productImageId))
    throw new Error('BLOCKED_IMAGE_PROVENANCE');
  const asset = await resolveAuthorizedProductImageAsset(client, input);
  const url = new URL(asset.publicUrl);
  const prefix = `/storage/v1/object/`;
  const parts = url.pathname.slice(prefix.length).split('/');
  if (
    url.origin !== 'https://vnmkupzptujtywnnabkp.supabase.co' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith(prefix) ||
    !['public', 'authenticated'].includes(parts[0] ?? '') ||
    !['lihen-product-web', 'lihen-product-originals'].includes(parts[1] ?? '') ||
    parts[2] !== 'products' ||
    parts[3] !== input.productId ||
    parts[4] !== input.productImageId ||
    !parts.slice(5).join('/')
  )
    throw new Error('BLOCKED_IMAGE_PROVENANCE');
  const { bytes } = await fetchResolvedProductImageBytes(asset, {
    maxBytes: 12 * 1024 * 1024,
    fetchImpl: (resource) =>
      fetchImpl(resource, { redirect: 'error', signal: AbortSignal.timeout(30000) }),
  });
  const mimeType =
    bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? 'image/jpeg'
      : bytes
            .slice(0, 8)
            .every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]) &&
          bytes.length >= 8
        ? 'image/png'
        : new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
            new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
          ? 'image/webp'
          : null;
  if (!mimeType) throw new Error('BLOCKED_INVALID_IMAGE');
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const assetRef = `sha256:${sha256}`;
  return {
    assetRef,
    mimeType,
    sourceUri: `data:${mimeType};base64,${btoa(binary)}`,
    metadata: {
      provenance: {
        productId: input.productId,
        imageId: input.productImageId,
        sourceReference: url.origin + url.pathname,
        sourceKind: 'DEV_EXISTING_IMAGE',
        sha256,
        assetRef,
        bindingStatus: 'VERIFIED',
      },
    },
  };
}
