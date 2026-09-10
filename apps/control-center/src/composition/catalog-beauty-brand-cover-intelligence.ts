import { BEAUTY_BRAND_COVER_AUDIT_MANIFEST } from './catalog-beauty-brand-cover-audit-manifest';

export type BeautyBrandCoverAuditRecord = {
  brand: string;
  canonicalBrand: string;
  finalMode: 'VERIFIED_ASSET' | 'VERIFIED_WORDMARK' | 'REVIEW_WORDMARK';
  currentMode: string;
  selectedAssetUrl: string | null;
  selectedSourceUrl: string | null;
  preferredLines: number;
  targetOccupancy: number;
  reviewRequired: boolean;
  suspiciousSignals: readonly string[];
  strongSignals: readonly string[];
  reason: readonly string[];
};

const records =
  BEAUTY_BRAND_COVER_AUDIT_MANIFEST as unknown as
    readonly BeautyBrandCoverAuditRecord[];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveBeautyBrandCoverAudit(
  brand: string,
): BeautyBrandCoverAuditRecord | null {
  const target = normalize(brand);
  return records.find((record) => normalize(record.brand) === target) ?? null;
}

export function computeBeautyBrandWordmarkFit(args: {
  frameWidth: number;
  frameHeight: number;
  name: string;
  preferredLines: number;
  targetOccupancy: number;
}) {
  const frameWidth = Math.max(1, args.frameWidth);
  const frameHeight = Math.max(1, args.frameHeight);
  const lines = Math.max(1, Math.min(3, args.preferredLines));
  const compact = args.name.replace(/\s+/g, ' ').trim();
  const charCount = Math.max(1, compact.length);

  // Estimate effective chars per line; the 0.57 factor approximates a serif
  // wordmark's average glyph width. The result is then bounded by frame height.
  const effectiveChars = Math.max(4, Math.ceil(charCount / lines));
  const targetWidth = frameWidth * Math.min(0.95, Math.max(0.78, args.targetOccupancy));
  const targetHeight = frameHeight * 0.78;

  const widthDriven = targetWidth / (effectiveChars * 0.57);
  const heightDriven = targetHeight / (lines * 1.02);
  const fontSize = Math.max(22, Math.min(widthDriven, heightDriven, 104));

  return {
    lines,
    fontSize,
    lineHeight: lines === 1 ? 0.95 : 0.92,
    maxWidth: targetWidth,
    maxHeight: targetHeight,
  };
}
