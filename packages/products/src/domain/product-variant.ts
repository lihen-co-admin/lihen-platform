/**
 * WAVE 4 / GAP-011 — Product Variant / Commercial Presentation.
 *
 * ProductVariant represents a commercial/visual differentiation of one Product Master.
 * It does not own price, stock, images, supplier identity or catalog selection.
 */

export type ProductVariantScalar = string | number | boolean;

export interface ProductVariantAttributes {
  readonly size?: string;
  readonly sizeRange?: string;
  readonly color?: string;
  readonly tone?: string;
  readonly presentation?: string;
  readonly quantity?: number;
  readonly unit?: string;
  readonly material?: string;
  readonly packCount?: number;
  readonly pieceCount?: number;
  readonly styleAttributes?: Readonly<Record<string, ProductVariantScalar>>;
}

export interface ProductVariantProps {
  readonly id: string;
  readonly productId: string;
  readonly variantCode?: string;
  readonly attributes: ProductVariantAttributes;
}

function normalizeText(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized ? normalized : undefined;
}

function normalizePositiveNumber(
  field: string,
  value: number | undefined,
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Product variant ${field} must be greater than zero.`);
  }
  return value;
}

function normalizePositiveInteger(
  field: string,
  value: number | undefined,
): number | undefined {
  const normalized = normalizePositiveNumber(field, value);
  if (normalized !== undefined && !Number.isInteger(normalized)) {
    throw new Error(`Product variant ${field} must be an integer.`);
  }
  return normalized;
}

function normalizeStyleAttributes(
  attributes: Readonly<Record<string, ProductVariantScalar>> | undefined,
): Readonly<Record<string, ProductVariantScalar>> | undefined {
  if (!attributes) return undefined;

  const normalized = Object.fromEntries(
    Object.entries(attributes)
      .map(([key, value]) => [key.trim(), value] as const)
      .filter(([key]) => key.length > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeAttributes(
  attributes: ProductVariantAttributes,
): ProductVariantAttributes {
  const normalized: {
    size?: string;
    sizeRange?: string;
    color?: string;
    tone?: string;
    presentation?: string;
    quantity?: number;
    unit?: string;
    material?: string;
    packCount?: number;
    pieceCount?: number;
    styleAttributes?: Readonly<Record<string, ProductVariantScalar>>;
  } = {};

  const size = normalizeText(attributes.size);
  if (size !== undefined) normalized.size = size;

  const sizeRange = normalizeText(attributes.sizeRange);
  if (sizeRange !== undefined) normalized.sizeRange = sizeRange;

  const color = normalizeText(attributes.color);
  if (color !== undefined) normalized.color = color;

  const tone = normalizeText(attributes.tone);
  if (tone !== undefined) normalized.tone = tone;

  const presentation = normalizeText(attributes.presentation);
  if (presentation !== undefined) normalized.presentation = presentation;

  const quantity = normalizePositiveNumber('quantity', attributes.quantity);
  if (quantity !== undefined) normalized.quantity = quantity;

  const unit = normalizeText(attributes.unit);
  if (unit !== undefined) normalized.unit = unit;

  const material = normalizeText(attributes.material);
  if (material !== undefined) normalized.material = material;

  const packCount = normalizePositiveInteger('packCount', attributes.packCount);
  if (packCount !== undefined) normalized.packCount = packCount;

  const pieceCount = normalizePositiveInteger('pieceCount', attributes.pieceCount);
  if (pieceCount !== undefined) normalized.pieceCount = pieceCount;

  const styleAttributes = normalizeStyleAttributes(attributes.styleAttributes);
  if (styleAttributes !== undefined) {
    normalized.styleAttributes = styleAttributes;
  }

  return normalized;
}

function hasMeaningfulAttributes(attributes: ProductVariantAttributes): boolean {
  return Object.keys(attributes).length > 0;
}

export class ProductVariant {
  public readonly id: string;
  public readonly productId: string;
  public readonly variantCode: string | undefined;
  public readonly attributes: ProductVariantAttributes;

  public constructor(props: ProductVariantProps) {
    const id = props.id.trim();
    const productId = props.productId.trim();
    const variantCode = normalizeText(props.variantCode);
    const attributes = normalizeAttributes(props.attributes);

    if (!id) throw new Error('Product variant id is required.');
    if (!productId) throw new Error('Product variant productId is required.');
    if (!variantCode && !hasMeaningfulAttributes(attributes)) {
      throw new Error(
        'Product variant requires a variantCode or at least one differentiating attribute.',
      );
    }

    this.id = id;
    this.productId = productId;
    this.variantCode = variantCode;
    this.attributes = attributes;
  }
}

function stableAttributeEntries(
  attributes: ProductVariantAttributes,
): readonly [string, ProductVariantScalar][] {
  const entries: [string, ProductVariantScalar][] = [];

  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'styleAttributes') {
      const styleAttributes = value as
        | Readonly<Record<string, ProductVariantScalar>>
        | undefined;
      for (const [styleKey, styleValue] of Object.entries(
        styleAttributes ?? {},
      ).sort(([left], [right]) => left.localeCompare(right))) {
        entries.push([`style.${styleKey}`, styleValue]);
      }
      continue;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      entries.push([key, value]);
    }
  }

  return entries.sort(([left], [right]) => left.localeCompare(right));
}

/**
 * Deterministic comparison key for review/reconciliation.
 * It is not a database primary key and must never replace Product Master identity.
 */
export function productVariantFingerprint(
  variant: Pick<ProductVariant, 'productId' | 'variantCode' | 'attributes'>,
): string {
  const parts = [
    `product:${variant.productId.trim()}`,
    ...(variant.variantCode
      ? [`code:${variant.variantCode.trim().toLowerCase()}`]
      : []),
    ...stableAttributeEntries(variant.attributes).map(
      ([key, value]) =>
        `${key}:${typeof value === 'string' ? value.trim().toLowerCase() : String(value)}`,
    ),
  ];

  return parts.join('|');
}

export function sameProductVariantDefinition(
  left: Pick<ProductVariant, 'productId' | 'variantCode' | 'attributes'>,
  right: Pick<ProductVariant, 'productId' | 'variantCode' | 'attributes'>,
): boolean {
  return productVariantFingerprint(left) === productVariantFingerprint(right);
}
