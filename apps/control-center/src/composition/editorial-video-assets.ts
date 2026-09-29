import { getBrowserSupabaseClient } from '@lihen/database';

export interface EditorialVideoAsset {
  id: string;
  productId: string;
  publicUrl: string;
  mimeType: string;
}
interface VideoReader {
  rpc(name: string, args: { p_product_id: string }): PromiseLike<{ data: unknown; error: unknown }>;
}
export async function readEditorialVideoAssets(
  productId: string,
  client: VideoReader = getBrowserSupabaseClient(import.meta.env),
): Promise<EditorialVideoAsset[]> {
  const result = await client.rpc('get_marketing_editorial_video_assets', {
    p_product_id: productId,
  });
  if (result.error || !Array.isArray(result.data))
    throw new Error('Videos autorizados no disponibles.');
  return result.data.flatMap((row: Record<string, unknown>) =>
    row.product_id === productId &&
    row.status === 'ACTIVE' &&
    typeof row.id === 'string' &&
    typeof row.public_url === 'string' &&
    row.public_url.trim() &&
    typeof row.mime_type === 'string' &&
    ['video/mp4', 'video/quicktime'].includes(row.mime_type)
      ? [{ id: row.id, productId, publicUrl: row.public_url, mimeType: row.mime_type }]
      : [],
  );
}
export function usesEditorialVideo(channel: string): boolean {
  return channel === 'TIKTOK' || channel === 'INSTAGRAM_REEL';
}
