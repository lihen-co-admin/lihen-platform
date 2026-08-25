export type StorefrontMediaProfile = 'WEB_CARD' | 'WEB_DETAIL' | 'CATALOG_PDF';

export interface StorefrontMedia {
  url: string;
  width: number;
  height: number;
  profile: StorefrontMediaProfile;
}

export function mediaAttributes(
  media: StorefrontMedia,
  sizes: string,
  options: { priority?: boolean; fallback?: boolean } = {},
): string {
  const loading = options.priority ? 'fetchpriority="high"' : 'loading="lazy"';
  const fallback = options.fallback ? ' data-media-fallback="true"' : '';
  return `src="${media.url}" srcset="${media.url} ${media.width}w" sizes="${sizes}" width="${media.width}" height="${media.height}" ${loading} decoding="async"${fallback}`;
}

export function legacyMedia(url: string, profile: StorefrontMediaProfile = 'WEB_CARD'): StorefrontMedia {
  return { url, width: 345, height: 176, profile };
}
