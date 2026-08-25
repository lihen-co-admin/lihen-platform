export type StyleIdentityAction =
  | 'KEEP_STYLE_SKU'
  | 'PROPOSE_NEW_STYLE_SKU'
  | 'COMPLETE_CATALOG_CODE';

export type StyleCategoryProposal =
  | 'ACCESORIOS'
  | 'BLUSAS_Y_BODIES'
  | 'CAMISETAS'
  | 'ROPA_DEPORTIVA_MUJER'
  | 'ROPA_DEPORTIVA_HOMBRE'
  | 'MEDIAS'
  | 'REVIEW_REQUIRED';

export interface StyleIdentityTaxonomyDryRunInput {
  readonly sku?: string;
  readonly catalogCode?: string;
  readonly productName: string;
}

export interface StyleIdentityTaxonomyDryRunResult {
  readonly identityAction: StyleIdentityAction;
  readonly preservesExistingStyleSku: boolean;
  readonly categoryProposal: StyleCategoryProposal;
  readonly categoryRequiresApproval: true;
  readonly brandRequiresApproval: true;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('es-CO');
}

export function proposeStyleCategory(productName: string): StyleCategoryProposal {
  const name = normalize(productName);

  if (/\b(anillo|aretes?|ear cuff)\b/.test(name)) return 'ACCESORIOS';
  if (/\b(blusa|body)\b/.test(name)) return 'BLUSAS_Y_BODIES';
  if (/\bcamiseta\b/.test(name)) return 'CAMISETAS';
  if (/\bmedias?\b/.test(name)) return 'MEDIAS';
  if (/\b(pantaloneta|short)\b/.test(name) && /\bhombre\b/.test(name)) return 'ROPA_DEPORTIVA_HOMBRE';
  if (/\b(conjunto|falda|short|push up|top)\b/.test(name)) return 'ROPA_DEPORTIVA_MUJER';

  return 'REVIEW_REQUIRED';
}

export function evaluateStyleIdentityTaxonomyDryRun(
  input: StyleIdentityTaxonomyDryRunInput,
): StyleIdentityTaxonomyDryRunResult {
  const sku = input.sku?.trim();
  const catalogCode = input.catalogCode?.trim();
  const hasStyleSku = Boolean(sku && /^ST-\d+$/i.test(sku));

  const identityAction: StyleIdentityAction = !hasStyleSku
    ? 'PROPOSE_NEW_STYLE_SKU'
    : !catalogCode
      ? 'COMPLETE_CATALOG_CODE'
      : 'KEEP_STYLE_SKU';

  return {
    identityAction,
    preservesExistingStyleSku: hasStyleSku,
    categoryProposal: proposeStyleCategory(input.productName),
    categoryRequiresApproval: true,
    brandRequiresApproval: true,
  };
}
