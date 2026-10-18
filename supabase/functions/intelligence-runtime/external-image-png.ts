export const MAX_EXTERNAL_BYTES = 12 * 1024 * 1024;
/** Restricted initial format: static PNG only. Header checks precede the real WASM decoder.
 * Reject unsupported formats instead of passing arbitrary bytes to ImageMagick autodetection. */
export function inspectExternalPng(bytes: Uint8Array): { width: number; height: number } {
  if (
    bytes.length < 45 ||
    bytes.length > MAX_EXTERNAL_BYTES ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  )
    throw new Error('EXTERNAL_IMAGE_STATIC_PNG_REQUIRED');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16),
    height = view.getUint32(20);
  if (
    view.getUint32(8) !== 13 ||
    String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR' ||
    Math.min(width, height) < 600 ||
    Math.max(width, height) > 4096 ||
    width * height > 8_000_000
  )
    throw new Error('EXTERNAL_IMAGE_DIMENSIONS_INVALID');
  let offset = 8,
    ended = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset),
      tag = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (length > MAX_EXTERNAL_BYTES || offset + 12 + length > bytes.length || tag === 'acTL')
      throw new Error('EXTERNAL_IMAGE_PNG_INVALID');
    offset += 12 + length;
    if (tag === 'IEND') {
      ended = length === 0 && offset === bytes.length;
      break;
    }
  }
  if (!ended) throw new Error('EXTERNAL_IMAGE_PNG_INVALID');
  return { width, height };
}
