import type {
  SearchProductIdentity,
  SearchResultItem,
  IntelligenceToolContext,
} from '../src/provider-ports';
import type { EditorialAuthorityRecord } from '../src/capabilities/editorial-research';

// Reserved example domains and synthetic extracts: no real research or network calls.
export const identity: SearchProductIdentity = {
  productId: 'durable-product',
  productName: 'Agua de rosas',
  sku: 'BC-067',
  brandId: 'brand-a',
  brand: 'Marca A',
  category: 'Cuidado',
};
export const context: IntelligenceToolContext = {
  correlationId: 'fixture',
  requestedBy: 'fixture-operator',
  context: { contextId: 'fixture', type: 'PRODUCT', entityId: identity.productId, attributes: {} },
};
export const authority: EditorialAuthorityRecord = {
  domain: 'brand-a.example',
  brandId: 'brand-a',
  brand: 'Marca A',
  role: 'OFFICIAL_BRAND',
  verification: {
    evidenceRef: 'registry:domain-ownership:fixture',
    reason: 'Synthetic test-only domain ownership record',
    verifiedAt: '2026-09-01T00:00:00Z',
    expiresAt: '2026-10-01T00:00:00Z',
  },
};
export const freeOnly = {
  evidenceRef: 'registry:free-only:fixture',
  verifiedAt: '2026-09-01T00:00:00Z',
};
export function searchResult(): SearchResultItem {
  return {
    title: 'Synthetic product source',
    uri: 'https://brand-a.example/product',
    snippet: 'Discovery only',
    productEvidence: {
      domain: 'brand-a.example',
      retrievedAt: '2026-09-29T00:00:00Z',
      identity: {
        productName: { value: 'Agua de rosas', evidenceRef: 'identity' },
        brand: { value: 'Marca A', evidenceRef: 'identity' },
        sku: { value: 'BC-067', evidenceRef: 'identity' },
        category: { value: 'Cuidado', evidenceRef: 'identity' },
      },
      extracts: [
        { id: 'identity', text: 'Agua de rosas · Marca A · BC-067 · Cuidado' },
        { id: 'ingredient', text: 'Ingrediente documentado en fixture' },
        { id: 'name-conflict', text: 'Conflicting external name' },
      ],
      claims: [
        {
          field: 'ingredients',
          value: 'Ingrediente documentado en fixture',
          evidenceRefs: ['ingredient'],
        },
        { field: 'name', value: 'Conflicting external name', evidenceRefs: ['name-conflict'] },
      ],
    },
  };
}
