import { describe, expect, it } from 'vitest';

import { extractEditorialProductEvidence } from '../../../../supabase/functions/intelligence-runtime/providers/editorial-evidence-extractor';

const identity = {
  productId: 'product-067',
  productName: 'Agua de rosas',
  sku: 'BC-067',
  brandId: 'brand-a',
  brand: 'Marca A',
  category: 'Cuidado facial',
  knownAttributes: {
    presentation: '120 ml',
  },
} as const;

function document(text: string, contentType = 'text/html') {
  return {
    url: 'https://brand.example/products/agua-de-rosas',
    domain: 'brand.example',
    retrievedAt: '2026-09-29T20:00:00.000Z',
    contentType,
    text,
  };
}

describe('Editorial evidence extractor', () => {
  it('extracts exact product identity from retrieved HTML', () => {
    const result = extractEditorialProductEvidence(
      document(`
        <html>
          <body>
            <h1>Agua de rosas</h1>
            <p>Marca A</p>
            <p>SKU: BC-067</p>
            <p>Cuidado facial</p>
            <p>Presentación 120 ml</p>
          </body>
        </html>
      `),
      identity,
    );

    expect(result.evidence.identity.productName?.value).toBe('Agua de rosas');
    expect(result.evidence.identity.sku?.value).toBe('BC-067');
    expect(result.evidence.identity.brand?.value).toBe('Marca A');
    expect(result.evidence.identity.category?.value).toBe('Cuidado facial');
    expect(result.evidence.identity.knownAttributes?.presentation?.value).toBe('120 ml');

    expect(result.evidence.claims).toEqual([
      {
        field: 'presentation',
        value: '120 ml',
        evidenceRefs: ['identity.attribute.presentation'],
      },
    ]);
  });

  it('does not treat script or style content as evidence', () => {
    const result = extractEditorialProductEvidence(
      document(`
        <html>
          <style>.x::after { content: "Marca A"; }</style>
          <script>window.product = "BC-067 Agua de rosas";</script>
          <body>Catálogo general</body>
        </html>
      `),
      identity,
    );

    expect(result.evidence.extracts).toEqual([]);
    expect(result.matchedIdentityFields).toEqual([]);
  });

  it('returns only identity fields actually present', () => {
    const result = extractEditorialProductEvidence(
      document('<p>Agua de rosas · Marca A</p>'),
      identity,
    );

    expect(result.matchedIdentityFields).toEqual(['productName', 'brand']);
    expect(result.evidence.identity.sku).toBeUndefined();
    expect(result.evidence.identity.category).toBeUndefined();
  });

  it('does not manufacture evidence from a generic product name', () => {
    const result = extractEditorialProductEvidence(
      document('<h1>Agua de rosas</h1><p>Marca B</p>'),
      identity,
    );

    expect(result.evidence.identity.productName?.value).toBe('Agua de rosas');
    expect(result.evidence.identity.brand).toBeUndefined();
    expect(result.evidence.identity.sku).toBeUndefined();
    expect(result.evidence.claims).toEqual([]);
  });

  it('extracts known attributes only when their exact value is present', () => {
    const result = extractEditorialProductEvidence(
      document('<p>Agua de rosas Marca A BC-067 presentación 120 ml</p>'),
      identity,
    );

    expect(result.evidence.identity.knownAttributes?.presentation).toEqual({
      value: '120 ml',
      evidenceRef: 'identity.attribute.presentation',
    });
  });

  it('supports plain text documents', () => {
    const result = extractEditorialProductEvidence(
      document('Agua de rosas | Marca A | BC-067 | Cuidado facial', 'text/plain'),
      identity,
    );

    expect(result.matchedIdentityFields).toEqual(['productName', 'sku', 'brand', 'category']);
  });

  it('creates a presentation claim only from exact retrieved catalog evidence', () => {
    const result = extractEditorialProductEvidence(
      document('<p>Agua de rosas Marca A BC-067 Presentación 120 ml</p>'),
      identity,
    );

    expect(result.evidence.claims).toEqual([
      {
        field: 'presentation',
        value: '120 ml',
        evidenceRefs: ['identity.attribute.presentation'],
      },
    ]);
  });

  it('does not create a presentation claim when the exact catalog value is absent', () => {
    const result = extractEditorialProductEvidence(
      document('<p>Agua de rosas Marca A BC-067 Presentación grande</p>'),
      identity,
    );

    expect(result.evidence.claims).toEqual([]);
  });

  it('does not convert free-form benefit language into a claim', () => {
    const result = extractEditorialProductEvidence(
      document(
        '<p>Agua de rosas Marca A BC-067 120 ml. Ayuda a dejar la piel suave y luminosa.</p>',
      ),
      identity,
    );

    expect(result.evidence.claims).toEqual([
      {
        field: 'presentation',
        value: '120 ml',
        evidenceRefs: ['identity.attribute.presentation'],
      },
    ]);
    expect(result.evidence.claims.some((claim) => claim.field === 'benefits')).toBe(false);
  });

  it('never converts benefit language into claims', () => {
    const result = extractEditorialProductEvidence(
      document(`
        <h1>Agua de rosas</h1>
        <p>Marca A · BC-067</p>
        <p>Ayuda a dejar la piel suave y luminosa.</p>
      `),
      identity,
    );

    expect(result.evidence.claims).toEqual([]);
  });
});
