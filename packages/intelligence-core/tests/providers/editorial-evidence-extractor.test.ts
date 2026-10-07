import { describe, expect, it } from 'vitest';

import { extractEditorialProductEvidence } from '../../../../supabase/functions/intelligence-runtime/providers/editorial-evidence-extractor';
import {
  assessEditorialSearchResult,
  researchEditorialProduct,
  verifyEditorialSourceIdentity,
} from '../../src/capabilities/editorial-research';
import {
  authority,
  context,
  freeOnly,
  identity as researchIdentity,
} from '../editorial-research.fixture';

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
  it.each(['Ingredientes activos', 'Active ingredients'])(
    'extracts a bounded Shopify sequence under %s',
    (label) => {
      const { evidence } = extractEditorialProductEvidence(
        document(`
      <h2>Descripción</h2><div class="rte"><p>Primer párrafo.</p><p>Segundo &amp; exacto.</p></div>
      <h2>${label}</h2><div class="rte"><p><strong>Romero</strong></p><p>Texto de romero.</p><p>Ácido hialurónico</p><p>Texto del ácido.</p><p>Extracto de cebolla</p><p>Texto de cebolla.</p></div>
      <h2>Beneficios</h2><ul><li>Suavidad.</li><li>Frescura.</li></ul>
      <h2>Modo de uso</h2><p>Aplicar.</p><p>Enjuagar.</p>
      <h3>INSTRUCCIONES ADICIONALES</h3><p>No incluir.</p>
      <p>Size: 500 ml</p><p>500 ml</p>
    `),
        identity,
      );
      expect(evidence.claims.map(({ field, value }) => ({ field, value }))).toEqual([
        { field: 'description', value: 'Primer párrafo. Segundo & exacto.' },
        {
          field: 'ingredients',
          value:
            'Romero Texto de romero. Ácido hialurónico Texto del ácido. Extracto de cebolla Texto de cebolla.',
        },
        { field: 'benefits', value: 'Suavidad. Frescura.' },
        { field: 'usage', value: 'Aplicar. Enjuagar.' },
        { field: 'presentation', value: '500 ml' },
      ]);
      for (const claim of evidence.claims) {
        expect(evidence.extracts.find(({ id }) => id === claim.evidenceRefs[0])?.text).toBe(
          claim.value,
        );
      }
    },
  );

  it.each(['Size', 'Tamaño', 'Tamano'])('accepts only explicit %s presentation labels', (label) => {
    expect(
      extractEditorialProductEvidence(document(`<p>${label}: 500 ml</p>`), identity).evidence
        .claims[0]?.value,
    ).toBe('500 ml');
    expect(
      extractEditorialProductEvidence(
        document('<p>500 ml</p><p>Romero</p><p>Texto genérico.</p>'),
        identity,
      ).evidence.claims,
    ).toEqual([]);
  });

  it.each([
    '<h4>Unknown</h4>',
    '<summary>Unknown</summary>',
    '<hr>',
    '</div>',
    '<section>',
    '<div><div>',
    '<script>hidden</script>',
    '<style>hidden</style>',
    '<noscript>hidden</noscript>',
    '<!-- comment -->',
    '<p>Unknown: value</p>',
    '<p><strong>Unknown</strong></p>',
    '<p hidden>Hidden.</p>',
    '<p><span aria-hidden="true">Hidden.</span></p>',
  ])('stops contiguous content at boundary %s', (boundary) => {
    const { evidence } = extractEditorialProductEvidence(
      document(`<h2>Usage</h2><p>Exact.</p>${boundary}<p>Outside.</p>`),
      identity,
    );
    expect(evidence.claims).toEqual([
      { field: 'usage', value: 'Exact.', evidenceRefs: ['claim.usage.0'] },
    ]);
  });

  it('does not leave a presentation wrapper or traverse nested containers', () => {
    const { evidence } = extractEditorialProductEvidence(
      document(
        '<h2>Ingredients</h2><div class="rte"><p>Exact.</p></div><p>Outside.</p><h2>Benefits</h2><div><section><p>Nested.</p></section></div>',
      ),
      identity,
    );
    expect(evidence.claims.map(({ value }) => value)).toEqual(['Exact.']);
  });

  it('bounds a section to 32 contiguous blocks', () => {
    const { evidence } = extractEditorialProductEvidence(
      document('<h2>Usage</h2>' + '<p>Exact.</p>'.repeat(33)),
      identity,
    );
    expect(evidence.claims[0]?.value).toBe(Array(32).fill('Exact.').join(' '));
  });

  it('extracts all five explicit sections verbatim, with exact extract references', () => {
    const result = extractEditorialProductEvidence(
      document(`
      <h1>Agua de rosas</h1><p>Marca A</p><p>SKU: PUBLIC-500ML</p>
      <h2>Descripción</h2><p>Agua de rosas para tu rutina diaria. Sin perfume añadido.</p>
      <h2>Ingredientes</h2><p>Aqua, Rosa Damascena Flower Water.</p>
      <h3>Beneficios</h3><ul><li>Suavidad.</li><li>Frescura.</li></ul>
      <h2>Modo de uso</h2><p>Aplicar sobre la piel limpia. Evitar los ojos.</p>
      <p><strong>Presentación:</strong> 500 ml</p>
    `),
      { ...identity, category: undefined, knownAttributes: undefined },
    );
    expect(result.evidence.claims.map(({ field, value }) => ({ field, value }))).toEqual([
      { field: 'description', value: 'Agua de rosas para tu rutina diaria. Sin perfume añadido.' },
      { field: 'ingredients', value: 'Aqua, Rosa Damascena Flower Water.' },
      { field: 'benefits', value: 'Suavidad. Frescura.' },
      { field: 'usage', value: 'Aplicar sobre la piel limpia. Evitar los ojos.' },
      { field: 'presentation', value: '500 ml' },
    ]);
    for (const claim of result.evidence.claims) {
      expect(claim.evidenceRefs).toHaveLength(1);
      expect(result.evidence.extracts.find(({ id }) => id === claim.evidenceRefs[0])?.text).toBe(
        claim.value,
      );
    }
    expect(result.evidence.identity.knownAttributes).toBeUndefined();
    expect(
      verifyEditorialSourceIdentity(
        { ...identity, category: undefined, knownAttributes: undefined },
        {
          title: 'Product',
          uri: 'https://brand.example/product',
          productEvidence: result.evidence,
        },
      ),
    ).toBe('VERIFIED');
  });

  it.each(['description', 'ingredients', 'benefits', 'usage', 'presentation'])(
    'recognizes explicit English %s headings and plain-text labels',
    (field) => {
      for (const doc of [
        document(`<h2>${field}</h2><p>Exact text. Second sentence.</p>`),
        document(`${field}: Exact text. Second sentence.`, 'text/plain'),
      ]) {
        expect(extractEditorialProductEvidence(doc, identity).evidence.claims).toEqual([
          { field, value: 'Exact text. Second sentence.', evidenceRefs: [`claim.${field}.0`] },
        ]);
      }
    },
  );

  it.each(['script', 'style', 'noscript'])(
    'never uses %s, including fake sections and interruptions',
    (tag) => {
      for (const html of [
        `<${tag}><h2>Benefits</h2><p>Hidden claim.</p></${tag}><p>Catalog.</p>`,
        `<h2>Benefits</h2><${tag}>Hidden.</${tag}><p>Unrelated.</p>`,
        `<h2>Benefits</h2><p>Visible <${tag}>hidden</${tag}> text.</p>`,
        `<p>Catalog.</p><${tag}><h2>Benefits</h2><p>Unclosed.</p>`,
      ])
        expect(extractEditorialProductEvidence(document(html), identity).evidence.claims).toEqual(
          [],
        );
    },
  );

  it('rejects JSON-LD, unknown sections, empty sections and unrelated following content', () => {
    const result = extractEditorialProductEvidence(
      document(`
      <script type="application/ld+json">{"description":"Not evidence"}</script>
      <h2>Results</h2><p>Results claim.</p>
      <h2>Clinical claims</h2><p>Clinical claim.</p>
      <h2>Dermatological properties</h2><p>Dermatological claim.</p>
      <h2>Discounts</h2><p>50% off.</p>
      <h2>Availability</h2><p>In stock.</p>
      <h2>Description</h2><h2>Other</h2><p>Unrelated.</p>
      <h2>Usage</h2><p></p><p>Unrelated.</p>
      <section><h2>Ingredients</h2></section><p>Outside section.</p>
      <p>Generic benefits: smooth skin.</p>
    `),
      identity,
    );
    expect(result.evidence.claims).toEqual([]);
  });

  it('preserves inline wording across immediately associated paragraphs', () => {
    const result = extractEditorialProductEvidence(
      document(
        '<h2>Description</h2><p class="text">Hidra<strong>tante</strong> &amp; suave.</p><p>Second paragraph.</p>',
      ),
      identity,
    );
    expect(result.evidence.claims).toEqual([
      {
        field: 'description',
        value: 'Hidratante & suave. Second paragraph.',
        evidenceRefs: ['claim.description.0'],
      },
    ]);
  });

  it('supports research only with verified public identity, official authority and extracted claims', async () => {
    const expected = { ...researchIdentity, category: undefined };
    const { evidence } = extractEditorialProductEvidence(
      {
        ...document(
          '<h1>Agua de rosas</h1><p>Marca A PUBLIC-500ML</p><h2>Ingredientes activos</h2><div class="rte"><p>Romero</p><p>Texto exacto.</p></div><p>Size: 500 ml</p>',
        ),
        domain: authority.domain,
      },
      expected,
    );
    const result = {
      title: 'Synthetic product',
      uri: `https://${authority.domain}/product`,
      productEvidence: evidence,
    };
    expect(assessEditorialSearchResult(expected, result, [authority]).claims[0]?.usableInCopy).toBe(
      true,
    );
    expect(assessEditorialSearchResult(expected, result, [authority]).identityMatch).toBe(
      'VERIFIED',
    );
    expect(assessEditorialSearchResult(expected, result, [authority]).authority).toBe(
      'OFFICIAL_BRAND',
    );
    expect(assessEditorialSearchResult(expected, result).authority).toBe('UNVERIFIED');
    expect(assessEditorialSearchResult(expected, result).claims).toEqual([]);
    expect(
      assessEditorialSearchResult({ ...expected, category: 'Missing' }, result, [authority])
        .identityMatch,
    ).toBe('PARTIALLY_VERIFIED');
    expect(
      assessEditorialSearchResult({ ...expected, category: 'Missing' }, result, [authority]).claims,
    ).toEqual([]);
    const report = await researchEditorialProduct(expected, context, {
      authorities: [authority],
      freeOnly,
      search: {
        descriptor: {
          toolId: 'fixture',
          name: 'Fixture',
          kind: 'SEARCH',
          readOnly: true,
          version: '1',
          description: 'Synthetic',
        },
        search: async () => ({ status: 'SUCCESS', data: [result], messages: [] }),
      },
    });
    expect(report.evidenceStatus).toBe('SUPPORTED');
  });

  it('extracts exact product identity from retrieved HTML', () => {
    const result = extractEditorialProductEvidence(
      document(`
        <html>
          <body>
            <h1>Agua de rosas</h1>
            <p>Marca A</p>
            <p>SKU: BC-067</p>
            <p>Cuidado facial</p>
            <p>Presentación: 120 ml</p>
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
        evidenceRefs: ['claim.presentation.0'],
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

  it('creates a presentation claim from an explicit retrieved label', () => {
    const result = extractEditorialProductEvidence(
      document('<p>Agua de rosas Marca A BC-067</p><p>Presentación: 120 ml</p>'),
      identity,
    );

    expect(result.evidence.claims).toEqual([
      {
        field: 'presentation',
        value: '120 ml',
        evidenceRefs: ['claim.presentation.0'],
      },
    ]);
  });

  it('does not create a presentation claim from an unlabeled phrase', () => {
    const result = extractEditorialProductEvidence(
      document('<p>Agua de rosas Marca A BC-067 Presentación grande</p>'),
      identity,
    );

    expect(result.evidence.claims).toEqual([]);
  });

  it('does not turn generic text or an unlabeled known attribute into a claim', () => {
    const result = extractEditorialProductEvidence(
      document('<p>Agua de rosas Marca A 120 ml. Ayuda a dejar la piel suave.</p>'),
      identity,
    );
    expect(result.evidence.identity.knownAttributes?.presentation?.value).toBe('120 ml');
    expect(result.evidence.claims).toEqual([]);
  });

  it('never converts unsectioned benefit language into claims', () => {
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
