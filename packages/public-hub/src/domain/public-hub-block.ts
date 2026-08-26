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

export type PublicHubValidationIssueCode =
  | 'UNSUPPORTED_TYPE'
  | 'UNSUPPORTED_STATUS'
  | 'INVALID_SORT_ORDER'
  | 'INVALID_STARTS_AT'
  | 'INVALID_ENDS_AT'
  | 'INVALID_SCHEDULE'
  | 'INVALID_TARGET_URL'
  | 'INVALID_IMAGE_URL'
  | 'TARGET_REQUIRED'
  | 'TITLE_OR_CTA_REQUIRED'
  | 'PRODUCT_REQUIRED'
  | 'COLLECTION_REQUIRED'
  | 'HEADING_TITLE_REQUIRED'
  | 'TEXT_BODY_REQUIRED'
  | 'BANNER_CONTENT_REQUIRED';

export interface PublicHubValidationIssue {
  code: PublicHubValidationIssueCode;
  message: string;
}

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

function validTimestamp(value: string | null | undefined): boolean {
  return blank(value) || Number.isFinite(new Date(value!).getTime());
}

function validUrl(value: string | null | undefined): boolean {
  if (blank(value)) return true;
  try {
    const parsed = new URL(value!);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function getPublicHubBlockValidationIssues(draft: PublicHubBlockDraft): readonly PublicHubValidationIssue[] {
  const issues: PublicHubValidationIssue[] = [];

  if (!publicHubBlockTypes.includes(draft.blockType)) {
    issues.push({ code: 'UNSUPPORTED_TYPE', message: 'Tipo de bloque no soportado.' });
    return issues;
  }
  if (draft.status && !publicHubBlockStatuses.includes(draft.status)) {
    issues.push({ code: 'UNSUPPORTED_STATUS', message: 'Estado de bloque no soportado.' });
  }
  if (draft.sortOrder !== undefined && (!Number.isInteger(draft.sortOrder) || draft.sortOrder < 0)) {
    issues.push({ code: 'INVALID_SORT_ORDER', message: 'El orden debe ser un entero mayor o igual a cero.' });
  }
  if (!validTimestamp(draft.startsAt)) {
    issues.push({ code: 'INVALID_STARTS_AT', message: 'La fecha de inicio no es válida.' });
  }
  if (!validTimestamp(draft.endsAt)) {
    issues.push({ code: 'INVALID_ENDS_AT', message: 'La fecha de finalización no es válida.' });
  }
  if (validTimestamp(draft.startsAt) && validTimestamp(draft.endsAt) && draft.startsAt && draft.endsAt
    && new Date(draft.startsAt).getTime() >= new Date(draft.endsAt).getTime()) {
    issues.push({ code: 'INVALID_SCHEDULE', message: 'La fecha de inicio debe ser anterior a la fecha de finalización.' });
  }
  if (!validUrl(draft.targetUrl)) {
    issues.push({ code: 'INVALID_TARGET_URL', message: 'El destino debe contener una URL válida.' });
  }
  if (!validUrl(draft.imageUrl)) {
    issues.push({ code: 'INVALID_IMAGE_URL', message: 'La imagen debe contener una URL válida.' });
  }

  switch (draft.blockType) {
    case 'LINK':
    case 'SOCIAL':
    case 'CTA':
      if (blank(draft.targetUrl)) issues.push({ code: 'TARGET_REQUIRED', message: 'Este tipo de bloque necesita una URL de destino.' });
      if (blank(draft.title) && blank(draft.ctaLabel)) issues.push({ code: 'TITLE_OR_CTA_REQUIRED', message: 'Este tipo de bloque necesita un título o CTA.' });
      break;
    case 'PRODUCT':
      if (blank(draft.productId)) issues.push({ code: 'PRODUCT_REQUIRED', message: 'El bloque de producto necesita un producto canónico.' });
      break;
    case 'PRODUCT_COLLECTION':
      if (blank(draft.collectionKey)) issues.push({ code: 'COLLECTION_REQUIRED', message: 'La colección necesita una clave de colección.' });
      break;
    case 'HEADING':
      if (blank(draft.title)) issues.push({ code: 'HEADING_TITLE_REQUIRED', message: 'El encabezado necesita un título.' });
      break;
    case 'TEXT':
      if (blank(draft.body)) issues.push({ code: 'TEXT_BODY_REQUIRED', message: 'El bloque de texto necesita contenido.' });
      break;
    case 'BANNER':
      if (blank(draft.title) && blank(draft.imageUrl)) issues.push({ code: 'BANNER_CONTENT_REQUIRED', message: 'El banner necesita un título o una imagen.' });
      break;
  }

  return issues;
}

export function validatePublicHubBlockDraft(draft: PublicHubBlockDraft): void {
  const [issue] = getPublicHubBlockValidationIssues(draft);
  if (issue) throw new Error(issue.message);
}

export function isPublicHubBlockActiveAt(
  block: Pick<PublicHubBlockProps, 'status' | 'startsAt' | 'endsAt'>,
  at: Date,
): boolean {
  return getPublicHubBlockPublicationState(block, at) === 'LIVE';
}
