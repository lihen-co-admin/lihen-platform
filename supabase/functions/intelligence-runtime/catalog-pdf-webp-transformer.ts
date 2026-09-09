import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from 'npm:@imagemagick/magick-wasm@0.0.30';

const wasmBytes = await Deno.readFile(
  new URL(
    'magick.wasm',
    import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.30'),
  ),
);

await initializeImageMagick(wasmBytes);

export interface CatalogPdfWebpResult {
  readonly bytes: Uint8Array;
  readonly mimeType: 'image/webp';
  readonly width: number;
  readonly height: number;
}

export function convertApprovedPngToCatalogPdfWebp(
  input: Uint8Array,
): CatalogPdfWebpResult {
  if (input.byteLength === 0) {
    throw new Error('LIHEN_CATALOG_PDF_SOURCE_EMPTY');
  }

  let width = 0;
  let height = 0;

  const bytes = ImageMagick.read(input, (image) => {
    width = image.width;
    height = image.height;

    if (width <= 0 || height <= 0) {
      throw new Error('LIHEN_CATALOG_PDF_DIMENSIONS_INVALID');
    }

    image.strip();
    image.quality = 85;

    return image.write(
      MagickFormat.WebP,
      (data) => new Uint8Array(data),
    );
  });

  if (bytes.byteLength === 0) {
    throw new Error('LIHEN_CATALOG_PDF_WEBP_EMPTY');
  }

  return {
    bytes,
    mimeType: 'image/webp',
    width,
    height,
  };
}
