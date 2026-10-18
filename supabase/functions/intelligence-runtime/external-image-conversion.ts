import { convertApprovedPngToCatalogPdfWebp } from './catalog-pdf-webp-transformer.ts';
import { inspectExternalPng } from './external-image-png.ts';

export const EXTERNAL_WEBP_MAX_MS = 1_500;
export const EXTERNAL_WEBP_MAX_BYTES = 3 * 1024 * 1024;
// Conservative initial direct-isolate budget. The broader download policy remains unchanged.
export const EXTERNAL_WASM_MAX_PIXELS = 1_048_576;
export const EXTERNAL_WASM_MAX_INPUT_BYTES = 3 * 1024 * 1024;

/** Runs the existing single-threaded WASM converter in the Edge isolate. No secondary runtime.
 * A JS timer cannot interrupt synchronous WASM. The platform enforces the hard CPU/memory limits;
 * this elapsed-time check refuses a late result before upload and never pretends to preempt it.
 * Dependency/time injection is for local tests, never populated from a request or browser input.
 */
export function createExternalPngConverter(
  decode: (bytes: Uint8Array) => { bytes: Uint8Array; width: number; height: number },
  now: () => number = () => performance.now(),
) {
  return async (
    bytes: Uint8Array,
  ): Promise<{ bytes: Uint8Array; width: number; height: number }> => {
    const started = now();
    const dimensions = inspectExternalPng(bytes);
    if (
      bytes.length > EXTERNAL_WASM_MAX_INPUT_BYTES ||
      dimensions.width * dimensions.height > EXTERNAL_WASM_MAX_PIXELS
    ) {
      throw new Error('EXTERNAL_IMAGE_DECODE_INPUT_BUDGET_EXCEEDED');
    }
    const result = decode(bytes);
    const elapsed = now() - started;
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > EXTERNAL_WEBP_MAX_MS) {
      throw new Error('EXTERNAL_IMAGE_DECODE_BUDGET_EXCEEDED');
    }
    if (
      result.width !== dimensions.width ||
      result.height !== dimensions.height ||
      !result.bytes.length ||
      result.bytes.length > EXTERNAL_WEBP_MAX_BYTES
    ) {
      throw new Error('EXTERNAL_IMAGE_DECODE_RESULT_INVALID');
    }
    return result;
  };
}

const directConverter = createExternalPngConverter(convertApprovedPngToCatalogPdfWebp);
export async function convertExternalPng(
  bytes: Uint8Array,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  return directConverter(bytes);
}
