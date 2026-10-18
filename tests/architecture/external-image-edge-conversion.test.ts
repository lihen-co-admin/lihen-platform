import { describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
vi.mock('../../supabase/functions/intelligence-runtime/catalog-pdf-webp-transformer.ts', () => ({
  convertApprovedPngToCatalogPdfWebp: () => {
    throw new Error('REAL_WASM_ONLY_IN_RUNTIME_TEST');
  },
}));
import {
  createExternalPngConverter,
  EXTERNAL_WEBP_MAX_MS,
} from '../../supabase/functions/intelligence-runtime/external-image-conversion';
const root = resolve(import.meta.dirname, '../../supabase/functions/intelligence-runtime');
function fixture(width = 600, height = 600) {
  const b = new Uint8Array(45);
  b.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const v = new DataView(b.buffer);
  v.setUint32(8, 13);
  b.set([73, 72, 68, 82], 12);
  v.setUint32(16, width);
  v.setUint32(20, height);
  b.set([73, 69, 78, 68], 37);
  return b;
}
describe('direct-isolate WebP conversion contract', () => {
  it('calls the approved converter once without secondary execution contexts', async () => {
    const result = { bytes: new Uint8Array([1]), width: 600, height: 600 };
    const decode = vi.fn(() => result);
    expect(await createExternalPngConverter(decode, () => 0)(fixture())).toBe(result);
    expect(decode).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid PNG before decoding', async () => {
    const decode = vi.fn();
    await expect(createExternalPngConverter(decode)(new Uint8Array([1]))).rejects.toThrow(
      'STATIC_PNG',
    );
    expect(decode).not.toHaveBeenCalled();
  });
  it('rejects excessive decoded pixels before allocating WASM image memory', async () => {
    const decode = vi.fn();
    await expect(createExternalPngConverter(decode)(fixture(1400, 1400))).rejects.toThrow(
      'INPUT_BUDGET',
    );
    expect(decode).not.toHaveBeenCalled();
  });
  it('refuses late results without claiming synchronous preemption', async () => {
    let calls = 0;
    const now = () => (calls++ === 0 ? 0 : EXTERNAL_WEBP_MAX_MS + 1);
    await expect(
      createExternalPngConverter(
        () => ({ bytes: new Uint8Array([1]), width: 600, height: 600 }),
        now,
      )(fixture()),
    ).rejects.toThrow('DECODE_BUDGET');
  });
  it('refuses changed dimensions', async () => {
    await expect(
      createExternalPngConverter(() => ({ bytes: new Uint8Array([1]), width: 601, height: 600 }))(
        fixture(),
      ),
    ).rejects.toThrow('RESULT_INVALID');
  });
  it('refuses excessive WebP output', async () => {
    await expect(
      createExternalPngConverter(() => ({
        bytes: new Uint8Array(3 * 1024 * 1024 + 1),
        width: 600,
        height: 600,
      }))(fixture()),
    ).rejects.toThrow('RESULT_INVALID');
  });
  it('propagates decoder failures and produces no fallback file', async () => {
    await expect(
      createExternalPngConverter(() => {
        throw new Error('decode failed');
      })(fixture()),
    ).rejects.toThrow('decode failed');
  });
  it('has no forbidden conversion runtime dependencies', () => {
    for (const file of [
      'external-image-conversion.ts',
      'external-image-png.ts',
      'catalog-pdf-webp-transformer.ts',
    ]) {
      const source = readFileSync(resolve(root, file), 'utf8');
      expect(source).not.toMatch(
        /\bnew\s+(?:Worker|SharedWorker)\s*\(|node:|worker_threads|node:vm|\bsharp\b|libvips|child_process|SharedArrayBuffer|Atomics|\beval\s*\(/,
      );
      const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      expect(
        imports.every((spec) =>
          [
            './catalog-pdf-webp-transformer.ts',
            './external-image-png.ts',
            'npm:@imagemagick/magick-wasm@0.0.30',
          ].includes(spec!),
        ),
      ).toBe(true);
    }
    expect(existsSync(resolve(root, 'external-image-conversion-worker.ts'))).toBe(false);
  });
});
