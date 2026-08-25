import { describe, expect, it } from 'vitest';
import { evaluateStyleIdentityTaxonomyDryRun, proposeStyleCategory } from '../src';

describe('F5-S1A/B Style identity and taxonomy dry-run', () => {
  it('keeps an existing Style SKU and only proposes catalog-code completion when needed', () => {
    expect(evaluateStyleIdentityTaxonomyDryRun({ sku: 'ST-015', productName: 'Blusa Basica Manga Larga N' })).toMatchObject({
      identityAction: 'COMPLETE_CATALOG_CODE',
      preservesExistingStyleSku: true,
      categoryProposal: 'BLUSAS_Y_BODIES',
      categoryRequiresApproval: true,
      brandRequiresApproval: true,
    });
  });

  it('never treats a legacy Beauty SKU as a final Style identity', () => {
    expect(evaluateStyleIdentityTaxonomyDryRun({ sku: 'BC-064', catalogCode: 'BC-064', productName: 'Anillo corazon' })).toMatchObject({
      identityAction: 'PROPOSE_NEW_STYLE_SKU',
      preservesExistingStyleSku: false,
      categoryProposal: 'ACCESORIOS',
    });
  });

  it('proposes category families without making them canonical', () => {
    expect(proposeStyleCategory('Pantaloneta Licra Hombre con licra interior')).toBe('ROPA_DEPORTIVA_HOMBRE');
    expect(proposeStyleCategory('Short + Top Nylon Unicolor')).toBe('ROPA_DEPORTIVA_MUJER');
    expect(proposeStyleCategory('Producto Style por revisar')).toBe('REVIEW_REQUIRED');
  });
});
