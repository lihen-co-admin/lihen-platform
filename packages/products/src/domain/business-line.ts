export const BUSINESS_LINES = ['BEAUTY_CARE', 'STYLE'] as const;
export type BusinessLine = (typeof BUSINESS_LINES)[number];

export function isBusinessLine(value: string): value is BusinessLine {
  return (BUSINESS_LINES as readonly string[]).includes(value);
}

export function parseBusinessLine(value: string): BusinessLine {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'BEAUTY' || normalized === 'BEAUTYCARE') return 'BEAUTY_CARE';
  if (isBusinessLine(normalized)) return normalized;
  throw new Error(`Unsupported business line: ${value}`);
}
