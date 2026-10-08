export type LihenBusinessLine =
  | 'BEAUTY_CARE'
  | 'STYLE';

export interface LihenBrandContext {
  readonly brand:
    'LIHEN.CO | Beauty Care • Style';

  readonly signature:
    'Tu cuidado, tu estilo, tu esencia.';

  readonly officialLogoAsset:
    'LIHEN_LOGO_OFFICIAL';

  readonly personality:
    readonly string[];

  readonly palette:
    readonly string[];

  readonly hardRules:
    readonly string[];

  readonly beautyCare:
    readonly string[];

  readonly style:
    readonly string[];
}


export const LIHEN_BRAND_CONTEXT:
LihenBrandContext = {
  brand:
    'LIHEN.CO | Beauty Care • Style',

  signature:
    'Tu cuidado, tu estilo, tu esencia.',

  officialLogoAsset:
    'LIHEN_LOGO_OFFICIAL',

  personality: [
    'feminine',
    'delicate',
    'clean',
    'premium',
    'elegant',
    'warm',
    'modern',
    'aspirational',
  ],

  palette: [
    'pastel blush',
    'dusty pink',
    'soft lavender',
    'warm cream',
    'warm white',
    'soft lime accent',
    'gold/copper detail',
  ],

  hardRules: [
    'Preserve the official LIHEN logo exactly.',
    'Do not redesign, distort or recolor the official logo arbitrarily.',
    'Remove only accidental background around a logo when safe and reversible.',
    'Keep generous negative space and clear hierarchy.',
    'Avoid generic coupon, template or low-cost visual language.',
    'Do not invent prices, discounts, claims or commercial facts.',
    'GENERATED != OFFICIAL.',
    'RECOMMENDATION != EXECUTION.',
    'MESSAGE GENERATION != SENDING.',
  ],

  beautyCare: [
    'soft luminous beauty-boutique direction',
    'blush, cream and lavender',
    'subtle gold/copper detail',
    'organic soft forms',
    'delicate glow',
  ],

  style: [
    'editorial fashion direction',
    'lavender, nude and cream',
    'soft gold/copper detail',
    'delicate geometry',
    'premium fashion composition',
  ],
};


export function lihenBrandConstraints(
  businessLine?: string,
): readonly string[] {

  const line =
    businessLine === 'BEAUTY_CARE'
      ? LIHEN_BRAND_CONTEXT.beautyCare
      : businessLine === 'STYLE'
        ? LIHEN_BRAND_CONTEXT.style
        : [];

  return [
    `Brand: ${LIHEN_BRAND_CONTEXT.brand}`,
    `Signature: ${LIHEN_BRAND_CONTEXT.signature}`,
    ...LIHEN_BRAND_CONTEXT.hardRules,
    ...line,
  ];
}


export function formatLihenBrandContextForModel(
  businessLine?: string,
): string {

  return [
    `BRAND: ${LIHEN_BRAND_CONTEXT.brand}`,
    `SIGNATURE: ${LIHEN_BRAND_CONTEXT.signature}`,
    `OFFICIAL_LOGO: ${LIHEN_BRAND_CONTEXT.officialLogoAsset}`,
    `PERSONALITY: ${LIHEN_BRAND_CONTEXT.personality.join(', ')}`,
    `PALETTE: ${LIHEN_BRAND_CONTEXT.palette.join(', ')}`,
    '',
    'BRAND_RULES:',
    ...lihenBrandConstraints(
      businessLine,
    ).map(
      (item) =>
        `- ${item}`,
    ),
  ].join('\n');
}
