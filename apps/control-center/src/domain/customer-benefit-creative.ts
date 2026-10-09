export type CustomerBenefitCreativeLine =
  | 'BEAUTY_CARE'
  | 'STYLE';

export type CustomerBenefitCreativeType =
  | 'WELCOME'
  | 'PURCHASE_THRESHOLD'
  | 'RETURN_AFTER_EXPIRED';

export type CustomerBenefitCreativeStatus =
  | 'GENERATED'
  | 'ACTIVE'
  | 'REDEEMED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface CustomerBenefitCreativeInput {
  readonly benefit_code: string;
  readonly business_line: CustomerBenefitCreativeLine;
  readonly benefit_type: CustomerBenefitCreativeType;
  readonly status: CustomerBenefitCreativeStatus;
  readonly discount_percent: number;
  readonly valid_until: string | null;
}

export interface CustomerBenefitCustomerIdentity {
  readonly fullName?: string | null;
  readonly customerCode?: string | null;
  readonly whatsappPhone?: string | null;
  readonly phone?: string | null;
}

export interface CustomerBenefitCreativeTheme {
  readonly start: string;
  readonly middle: string;
  readonly end: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly text: string;
  readonly muted: string;
  readonly border: string;
  readonly glow: string;
  readonly limeGlow: string;
  readonly contour: string;
  readonly codeSurface: string;
  readonly statusSurface: string;
}

export const benefitCreativeThemes:
Record<CustomerBenefitCreativeLine, CustomerBenefitCreativeTheme> = {
  BEAUTY_CARE: {
    start: '#fffaf7',
    middle: '#f5d8ec',
    end: '#f7eee8',
    accent: '#b87555',
    accentSoft: '#f4d7df',
    text: '#392b2d',
    muted: '#79656a',
    border: '#d9b1a3',
    glow: '#f4badd',
    limeGlow: '#e7ffb3',
    contour: '#fffdfc',
    codeSurface: 'rgba(255,255,255,.70)',
    statusSurface: 'rgba(255,248,248,.82)',
  },

  STYLE: {
    start: '#faf7ff',
    middle: '#dfd1f2',
    end: '#f5e8e2',
    accent: '#966d83',
    accentSoft: '#ddcdeb',
    text: '#342b36',
    muted: '#716675',
    border: '#c9b1d5',
    glow: '#cbb1ef',
    limeGlow: '#eef6d4',
    contour: '#fffefe',
    codeSurface: 'rgba(255,255,255,.69)',
    statusSurface: 'rgba(249,245,255,.84)',
  },
};

export interface CustomerBenefitVisualModel {
  readonly lineLabel: string;
  readonly typeLabel: string;
  readonly statusLabel: string;
  readonly discountLabel: string;
  readonly codeLabel: string;
  readonly validityLabel: string;
  readonly validityValue: string;
  readonly emotionalHeadline: string;
  readonly emotionalCopy: string;
  readonly closingCopy: string;
  readonly cta: string;
  readonly redeemable: boolean;
  readonly theme: 'beauty-care' | 'style';
  readonly themeTokens: CustomerBenefitCreativeTheme;
}

const typeLabels: Record<
  CustomerBenefitCreativeType,
  string
> = {
  WELCOME: 'Bono de bienvenida',
  PURCHASE_THRESHOLD: 'Bono por compra',
  RETURN_AFTER_EXPIRED: 'Bono para volver a LIHEN',
};

const emotionalHeadline: Record<
  CustomerBenefitCreativeType,
  string
> = {
  WELCOME: 'Gracias por elegir LIHEN.CO',
  PURCHASE_THRESHOLD: 'Gracias por elegirnos',
  RETURN_AFTER_EXPIRED: 'Queremos volver a consentirte',
};

const emotionalCopy: Record<
  CustomerBenefitCreativeType,
  string
> = {
  WELCOME: 'Como muestra de bienvenida, tenemos un detalle especial para ti.',
  PURCHASE_THRESHOLD: 'Tu confianza merece un detalle especial.',
  RETURN_AFTER_EXPIRED: 'Tenemos un beneficio especial para darte la bienvenida nuevamente.',
};

const closingCopy: Record<
  CustomerBenefitCreativeType,
  string
> = {
  WELCOME: 'Esperamos acompañarte muy pronto.',
  PURCHASE_THRESHOLD: 'Disfruta tu beneficio en tu próxima compra.',
  RETURN_AFTER_EXPIRED: 'Te esperamos en LIHEN.',
};

const statusLabels: Record<
  CustomerBenefitCreativeStatus,
  string
> = {
  GENERATED: 'Preparado',
  ACTIVE: 'Activo',
  REDEEMED: 'Usado',
  EXPIRED: 'Vencido',
  CANCELLED: 'Cancelado',
};

function parseDate(
  value: string | null,
): Date | null {
  if (!value) return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function formatLongDate(
  value: string | null,
) {
  const parsed = parseDate(value);

  if (!parsed) {
    return 'Pendiente de activación';
  }

  return new Intl.DateTimeFormat(
    'es-CO',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Bogota',
    },
  ).format(parsed);
}

function formatShortDate(
  value: string | null,
) {
  const parsed = parseDate(value);

  if (!parsed) {
    return 'POR CONFIRMAR';
  }

  const parts =
    new Intl.DateTimeFormat(
      'es-CO',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'America/Bogota',
      },
    )
      .format(parsed)
      .replace(/\./g, '')
      .toUpperCase();

  return parts;
}

export function buildCustomerBenefitVisualModel(
  benefit: CustomerBenefitCreativeInput,
): CustomerBenefitVisualModel {
  const lineLabel =
    benefit.business_line === 'BEAUTY_CARE'
      ? 'Beauty Care'
      : 'Style';

  return {
    lineLabel,
    typeLabel:
      typeLabels[benefit.benefit_type],

    statusLabel:
      statusLabels[benefit.status],

    discountLabel:
      `${benefit.discount_percent}%`,

    codeLabel:
      benefit.benefit_code,

    validityLabel:
      benefit.valid_until
        ? `Vigente hasta ${formatLongDate(benefit.valid_until)}`
        : 'Pendiente de activación',

    validityValue:
      formatShortDate(
        benefit.valid_until,
      ),

    emotionalHeadline:
      emotionalHeadline[
        benefit.benefit_type
      ],

    emotionalCopy:
      emotionalCopy[
        benefit.benefit_type
      ],

    closingCopy:
      closingCopy[
        benefit.benefit_type
      ],

    cta:
      benefit.status === 'ACTIVE'
        ? 'Disfruta tu beneficio en tu próxima compra'
        : benefit.status === 'GENERATED'
          ? 'Tu beneficio está preparado para activarse'
          : 'Conservamos este beneficio como parte de tu historia LIHEN',

    redeemable:
      benefit.status === 'ACTIVE',

    theme:
      benefit.business_line === 'BEAUTY_CARE'
        ? 'beauty-care'
        : 'style',

    themeTokens:
      benefitCreativeThemes[
        benefit.business_line
      ],
  };
}

export function buildCustomerBenefitMessage(
  benefit: CustomerBenefitCreativeInput,
  customer?: CustomerBenefitCustomerIdentity | null,
) {
  const visual =
    buildCustomerBenefitVisualModel(
      benefit,
    );

  const greeting =
    customer?.fullName?.trim()
      ? `Hola, ${customer.fullName.trim()} ✨`
      : 'Hola ✨';

  const lineMessage =
    benefit.business_line === 'BEAUTY_CARE'
      ? 'Un detalle especial para seguir cuidándote.'
      : 'Un detalle especial para acompañar tu estilo.';

  const validity =
    benefit.valid_until
      ? `📅 ${visual.validityLabel}`
      : '📅 Vigencia pendiente de activación';

  return [
    greeting,
    '',
    'Tienes un beneficio especial de LIHEN.CO.',
    lineMessage,
    '',
    `🎁 ${visual.typeLabel}`,
    `💗 ${visual.discountLabel} de descuento`,
    `🔖 Código: ${visual.codeLabel}`,
    validity,
    '',
    benefit.status === 'ACTIVE'
      ? 'Presenta este código al realizar tu compra.'
      : `Estado actual: ${visual.statusLabel}.`,
    '',
    '✨ LIHEN.CO | Beauty Care • Style',
    'Tu cuidado, tu estilo, tu esencia.',
  ].join('\n');
}

export function customerBenefitWhatsAppUrl(
  message: string,
  customer?: CustomerBenefitCustomerIdentity | null,
) {
  const rawPhone =
    customer?.whatsappPhone?.trim() ||
    customer?.phone?.trim() ||
    '';

  const digits =
    rawPhone.replace(/\D/g, '');

  return digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function customerBenefitImageFileName(
  benefit: CustomerBenefitCreativeInput,
) {
  const safeCode =
    benefit.benefit_code
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        '-',
      )
      .replace(
        /^-+|-+$/g,
        '',
      );

  return `LIHEN-bono-${safeCode || 'beneficio'}.png`;
}
