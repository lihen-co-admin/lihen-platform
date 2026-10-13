import type { ProductImageDTO } from '@lihen/products';

export interface ProductWebpCandidate {
  readonly key: string;
  readonly file: File;
}

export interface ProductWebpUpload {
  readonly imageId: string;
  readonly sha256: string;
  readonly operationKey: string;
  readonly ownerId: string;
}

export interface ProductWebpProgress extends ProductWebpUpload {
  readonly key: string;
  readonly productId: string;
  readonly altText: string;
  readonly makeMain: boolean;
  readonly status: 'UPLOADED' | 'REGISTERED';
}

interface SaveProductWebpQueueInput {
  readonly productId: string;
  readonly ownerId: string;
  readonly candidates: readonly ProductWebpCandidate[];
  readonly registeredCount: number;
  readonly progress: readonly ProductWebpProgress[];
  readonly upload: (productId: string, file: File, ownerId: string) => Promise<ProductWebpUpload>;
  readonly register: (input: ProductWebpProgress) => Promise<void>;
  readonly onProgress: (progress: ProductWebpProgress) => void;
  readonly readBack: (productId: string) => Promise<readonly ProductImageDTO[]>;
}

export async function saveProductWebpQueue(
  input: SaveProductWebpQueueInput,
): Promise<readonly ProductImageDTO[]> {
  if (!input.productId || !input.ownerId)
    throw new Error('Producto y usuario autenticado requeridos.');
  if (input.candidates.length === 0 || input.registeredCount + input.candidates.length > 10) {
    throw new Error('Verifica que la galería tenga entre 1 y 10 imágenes en total.');
  }

  const progressByKey = new Map(input.progress.map((entry) => [entry.key, entry]));
  const expectedIds: string[] = [];

  for (const [index, candidate] of input.candidates.entries()) {
    if (candidate.file.type !== 'image/webp') throw new Error('El archivo preparado no es WebP.');
    const digest = await crypto.subtle.digest('SHA-256', await candidate.file.arrayBuffer());
    const fileHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    if (fileHash !== candidate.key) {
      throw new Error('El archivo cambió desde la conversión; no se reutilizó ninguna subida.');
    }
    let current = progressByKey.get(candidate.key);

    if (current) {
      if (
        current.productId !== input.productId ||
        current.ownerId !== input.ownerId ||
        current.sha256 !== candidate.key
      ) {
        throw new Error(
          'La subida pendiente pertenece a otro producto o usuario; no se reutilizó.',
        );
      }
    } else {
      const uploaded = await input.upload(input.productId, candidate.file, input.ownerId);
      if (uploaded.ownerId !== input.ownerId || uploaded.sha256 !== candidate.key) {
        throw new Error(
          'La identidad o el contenido de la subida no coincide con el archivo seleccionado.',
        );
      }
      current = {
        ...uploaded,
        key: candidate.key,
        productId: input.productId,
        altText: candidate.file.name.replace(/\.webp$/i, ''),
        makeMain: input.registeredCount + index === 0,
        status: 'UPLOADED',
      };
      progressByKey.set(candidate.key, current);
      input.onProgress(current);
    }

    if (current.status === 'UPLOADED') {
      await input.register(current);
      current = { ...current, status: 'REGISTERED' };
      progressByKey.set(candidate.key, current);
      input.onProgress(current);
    }
    expectedIds.push(current.imageId);
  }

  const images = await input.readBack(input.productId);
  if (images.length > 10) throw new Error('La galería supera el máximo de 10 imágenes.');
  for (const imageId of expectedIds) {
    if (!images.some((image) => image.id === imageId && image.productId === input.productId)) {
      throw new Error('El registro WebP no aparece en la lectura posterior de Product Master.');
    }
  }
  return images;
}
