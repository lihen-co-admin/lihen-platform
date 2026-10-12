import { PRODUCT_IMAGE_WEB_MAX_BYTES } from '@lihen/products';

export const LIHEN_WEBP_QUALITY = 0.85;
export const LIHEN_IMAGE_MAX_SIDE = 2000;
export const LIHEN_MAX_IMAGES = 10;
const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface OptimizedImage {
  readonly file: File;
  readonly originalBytes: number;
  readonly convertedBytes: number;
  readonly width: number;
  readonly height: number;
}

export async function optimizeProductImage(file: File): Promise<OptimizedImage> {
  if (!acceptedTypes.has(file.type) || file.size <= 0 || file.size > 12 * 1024 * 1024) {
    throw new Error('Imagen inválida: utiliza JPG, PNG o WebP hasta 12 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, LIHEN_IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('El navegador no permite optimizar la imagen.');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (output) => {
          if (output && output.type === 'image/webp') resolve(output);
          else reject(new Error('El navegador no pudo producir un archivo WebP válido.'));
        },
        'image/webp',
        LIHEN_WEBP_QUALITY,
      );
    });
    if (!blob.size || blob.size > PRODUCT_IMAGE_WEB_MAX_BYTES) {
      throw new Error('El WebP resultante supera 3 MB; utiliza una fotografía menos compleja.');
    }
    const name = file.name.replace(/\.[^.]+$/, '') || 'imagen';
    return {
      file: new File([blob], `${name}.webp`, { type: 'image/webp' }),
      originalBytes: file.size,
      convertedBytes: blob.size,
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}

export async function imageFileFromUrl(address: string): Promise<File> {
  const url = new URL(address);
  if (!['https:'].includes(url.protocol)) throw new Error('Solo se aceptan URL HTTPS.');
  const response = await fetch(url.href, { mode: 'cors', credentials: 'omit', redirect: 'follow' });
  if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('image/')) {
    throw new Error('La URL no devolvió una imagen accesible.');
  }
  const size = Number(response.headers.get('content-length') || 0);
  if (size > 12 * 1024 * 1024) throw new Error('La imagen remota supera 12 MB.');
  const blob = await response.blob();
  if (blob.size > 12 * 1024 * 1024) throw new Error('La imagen remota supera 12 MB.');
  const mime = blob.type.toLowerCase();
  if (!acceptedTypes.has(mime)) throw new Error('La URL no corresponde a JPG, PNG o WebP.');
  return new File([blob], 'imagen-url', { type: mime });
}
