export const publicHubBlockTypes = [
  'LINK',
  'SOCIAL',
  'PRODUCT',
  'PRODUCT_COLLECTION',
  'BANNER',
  'TEXT',
  'HEADING',
  'CTA',
] as const;

export type PublicHubBlockType = (typeof publicHubBlockTypes)[number];

export const publicHubBlockStatuses = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED'] as const;
export type PublicHubBlockStatus = (typeof publicHubBlockStatuses)[number];

export interface PublicHubBlockProps {
  id: string;
  blockType: PublicHubBlockType;
  status: PublicHubBlockStatus;
  sortOrder: number;
  productId?: string | null;
  collectionKey?: string | null;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
  targetUrl?: string | null;
  imageUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}


export const publicHubPublicationStates = ['DRAFT', 'HIDDEN', 'ARCHIVED', 'SCHEDULED', 'LIVE', 'EXPIRED'] as const;
export type PublicHubPublicationState = (typeof publicHubPublicationStates)[number];

export function getPublicHubBlockPublicationState(
  block: Pick<PublicHubBlockProps, 'status' | 'startsAt' | 'endsAt'>,
  at: Date,
): PublicHubPublicationState {
  if (block.status === 'DRAFT') return 'DRAFT';
  if (block.status === 'HIDDEN') return 'HIDDEN';
  if (block.status === 'ARCHIVED') return 'ARCHIVED';
  const timestamp = at.getTime();
  if (block.startsAt && new Date(block.startsAt).getTime() > timestamp) return 'SCHEDULED';
  if (block.endsAt && new Date(block.endsAt).getTime() <= timestamp) return 'EXPIRED';
  return 'LIVE';
}

export interface PublicHubBlockDraft {
  id?: string;
  blockType: PublicHubBlockType;
  status?: PublicHubBlockStatus;
  sortOrder?: number;
  productId?: string | null;
  collectionKey?: string | null;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
  targetUrl?: string | null;
  imageUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

function blank(value: string | null | undefined): boolean {
  return !value?.trim();
}

function assertValidUrl(value: string | null | undefined, field: string): void {
  if (blank(value)) return;
  try {
    const parsed = new URL(value!);
    if (!['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error(`${field} debe contener una URL válida.`);
  }
}

export function validatePublicHubBlockDraft(draft: PublicHubBlockDraft): void {
  if (!publicHubBlockTypes.includes(draft.blockType)) {
    throw new Error('Tipo de bloque no soportado.');
  }
  if (draft.status && !publicHubBlockStatuses.includes(draft.status)) {
    throw new Error('Estado de bloque no soportado.');
  }
  if (draft.sortOrder !== undefined && (!Number.isInteger(draft.sortOrder) || draft.sortOrder < 0)) {
    throw new Error('El orden debe ser un entero mayor o igual a cero.');
  }
  if (draft.startsAt && draft.endsAt && new Date(draft.startsAt).getTime() >= new Date(draft.endsAt).getTime()) {
    throw new Error('La fecha de inicio debe ser anterior a la fecha de finalización.');
  }

  assertValidUrl(draft.targetUrl, 'El destino');
  assertValidUrl(draft.imageUrl, 'La imagen');

  switch (draft.blockType) {
    case 'LINK':
    case 'SOCIAL':
    case 'CTA':
      if (blank(draft.targetUrl)) throw new Error('Este tipo de bloque necesita una URL de destino.');
      if (blank(draft.title) && blank(draft.ctaLabel)) throw new Error('Este tipo de bloque necesita un título o CTA.');
      break;
    case 'PRODUCT':
      if (blank(draft.productId)) throw new Error('El bloque de producto necesita un producto canónico.');
      break;
    case 'PRODUCT_COLLECTION':
      if (blank(draft.collectionKey)) throw new Error('La colección necesita una clave de colección.');
      break;
    case 'HEADING':
      if (blank(draft.title)) throw new Error('El encabezado necesita un título.');
      break;
    case 'TEXT':
      if (blank(draft.body)) throw new Error('El bloque de texto necesita contenido.');
      break;
    case 'BANNER':
      if (blank(draft.title) && blank(draft.imageUrl)) throw new Error('El banner necesita un título o una imagen.');
      break;
  }
}

export function isPublicHubBlockActiveAt(
  block: Pick<PublicHubBlockProps, 'status' | 'startsAt' | 'endsAt'>,
  at: Date,
): boolean {
  return getPublicHubBlockPublicationState(block, at) === 'LIVE';
}
