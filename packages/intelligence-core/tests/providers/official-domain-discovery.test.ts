import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchRequest } from '../../src/provider-ports';
import { createOfficialDomainDiscoveryPort } from '../../../../supabase/functions/intelligence-runtime/providers/official-domain-discovery';

const authority = {
  domain: 'brand.example',
  brandId: 'brand-a',
  brand: 'Marca A',
  role: 'OFFICIAL_BRAND',
  verification: {
    evidenceRef: 'registry:test',
    reason: 'Synthetic authority',
    verifiedAt: '2026-09-01',
    expiresAt: '2027-09-01',
  },
} as const;
const identity = {
  productId: 'p-067',
  productName: 'Agua de rosas',
  sku: 'BC-067',
  brandId: 'brand-a',
  brand: 'Marca A',
};
const request: SearchRequest = {
  correlationId: 'test',
  requestedBy: 'tester',
  context: { contextId: 'product:test', type: 'PRODUCT', attributes: {} },
  queries: [{ query: 'Agua de rosas BC-067' }],
  expectedProductIdentity: identity,
  costPolicy: 'FREE_ONLY',
};
const product = 'https://brand.example/products/agua-de-rosas-bc-067';
const urlset = (...urls: string[]) =>
  `<urlset>${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>`;
const index = (...urls: string[]) =>
  `<sitemapindex>${urls.map((url) => `<sitemap><loc>${url}</loc></sitemap>`).join('')}</sitemapindex>`;
function fixture(documents: Record<string, string | Response> = {}, authorities = [authority]) {
  const fetchImpl = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const doc = documents[String(input)];
    return doc instanceof Response
      ? doc
      : new Response(doc ?? '', { status: doc === undefined ? 404 : 200 });
  });
  return {
    fetchImpl,
    port: createOfficialDomainDiscoveryPort({
      allowedDomains: ['brand.example'],
      authorities,
      fetchImpl,
    }),
  };
}
afterEach(() => vi.useRealTimers());

describe('Official-domain sitemap discovery', () => {
  it('follows a same-host index to a product sitemap without retrieving pages or creating evidence', async () => {
    const { port, fetchImpl } = fixture({
      'https://brand.example/robots.txt': 'Sitemap: https://brand.example/index.xml',
      'https://brand.example/index.xml': index('https://brand.example/products.xml'),
      'https://brand.example/products.xml': urlset(product),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(port.descriptor.readOnly).toBe(true);
    const result = await port.search(request);
    expect(result.status).toBe('SUCCESS');
    expect(result.data).toEqual([
      {
        title: 'agua de rosas bc 067',
        uri: product,
        sourceName: 'Official-domain sitemap discovery',
        metadata: {
          discovery: 'sitemap',
          score: 125,
          skuMatch: true,
          matchedTokens: ['agua', 'rosas'],
          productPath: true,
        },
      },
    ]);
    expect(fetchImpl.mock.calls.map(([uri]) => uri)).toEqual([
      'https://brand.example/robots.txt',
      'https://brand.example/sitemap.xml',
      'https://brand.example/index.xml',
      'https://brand.example/products.xml',
    ]);
    expect(JSON.stringify(result)).not.toContain('productEvidence');
    for (const call of fetchImpl.mock.calls)
      expect(call[1]).toMatchObject({ method: 'GET', redirect: 'manual' });
  });

  it.each([
    'https://evil.example/products/agua-de-rosas-bc-067',
    'https://sub.brand.example/products/agua-de-rosas-bc-067',
    'http://brand.example/products/agua-de-rosas-bc-067',
    'https://user:pass@brand.example/products/agua-de-rosas-bc-067',
    'https://brand.example:443/products/agua-de-rosas-bc-067',
    'https://brand.example:8443/products/agua-de-rosas-bc-067',
    'https://brand.example\\@evil.example/products/agua-de-rosas-bc-067',
    'not a URL',
  ])('never admits or fetches a forbidden URL: %s', async (bad) => {
    const { port, fetchImpl } = fixture({
      'https://brand.example/robots.txt': `Sitemap: ${bad}`,
      'https://brand.example/sitemap.xml': index(bad, 'https://brand.example/pages.xml'),
      'https://brand.example/pages.xml': urlset(bad),
    });
    expect((await port.search(request)).status).toBe('NO_RESULT');
    expect(fetchImpl.mock.calls.map(([uri]) => uri)).toEqual([
      'https://brand.example/robots.txt',
      'https://brand.example/sitemap.xml',
      'https://brand.example/pages.xml',
    ]);
  });

  it.each([
    ['brand.example', 'www.brand.example'],
    ['www.brand.example', 'brand.example'],
  ])('never crosses from authorized host %s to %s', async (host, otherHost) => {
    const base = `https://${host}`;
    const otherBase = `https://${otherHost}`;
    const documents: Record<string, string | Response> = {
      [`${base}/robots.txt`]: `Sitemap: ${otherBase}/robots-map.xml`,
      [`${base}/sitemap.xml`]: index(
        `${otherBase}/index-map.xml`,
        `${base}/pages.xml`,
        `${base}/redirect.xml`,
      ),
      [`${base}/pages.xml`]: urlset(`${otherBase}/products/agua-de-rosas-bc-067`),
      [`${base}/redirect.xml`]: new Response(null, {
        status: 302,
        headers: { Location: `${otherBase}/redirected-map.xml` },
      }),
    };
    const fetchImpl = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const document = documents[String(input)];
      // A forbidden fetch must also fail the call assertions, even if discovery catches errors.
      if (document === undefined) throw new Error('UNEXPECTED_HOST_OR_URL');
      return document instanceof Response ? document : new Response(document);
    });
    const port = createOfficialDomainDiscoveryPort({
      authorities: [{ ...authority, domain: host }],
      allowedDomains: [host],
      fetchImpl,
    });

    const result = await port.search(request);

    expect(result).toMatchObject({ status: 'NO_RESULT', data: [] });
    expect(JSON.stringify(result)).not.toContain('productEvidence');
    expect(fetchImpl.mock.calls.map(([uri]) => String(uri))).toEqual([
      `${base}/robots.txt`,
      `${base}/sitemap.xml`,
      `${base}/pages.xml`,
      `${base}/redirect.xml`,
    ]);
    for (const [uri, init] of fetchImpl.mock.calls) {
      expect(new URL(String(uri)).hostname).toBe(host);
      expect(new URL(String(uri)).hostname).not.toBe(otherHost);
      expect(init).toMatchObject({ method: 'GET', redirect: 'manual' });
    }
  });

  it.each([
    undefined,
    { ...identity, brandId: 'another-brand' },
    { ...identity, brandId: undefined, brand: 'Marca' },
    { ...identity, brandId: undefined, brand: undefined },
  ])(
    'requires matching durable identity before any network: %j',
    async (expectedProductIdentity) => {
      const { port, fetchImpl } = fixture();
      expect(await port.search({ ...request, expectedProductIdentity })).toMatchObject({
        status: 'NO_RESULT',
        data: [],
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('permits normalized exact brand only when expected brandId is absent', async () => {
    const { port } = fixture({ 'https://brand.example/sitemap.xml': urlset(product) });
    expect(
      (
        await port.search({
          ...request,
          expectedProductIdentity: { ...identity, brandId: undefined, brand: ' MARCA   A ' },
        })
      ).status,
    ).toBe('SUCCESS');
  });

  it.each(['AUTHORIZED_SUPPLIER', 'SECONDARY_REFERENCE'])(
    'does not discover from %s',
    async (role) => {
      const fetchImpl = vi.fn();
      const port = createOfficialDomainDiscoveryPort({
        allowedDomains: ['brand.example'],
        authorities: [{ ...authority, role: role as 'AUTHORIZED_SUPPLIER' }],
        fetchImpl,
      });
      expect((await port.search(request)).status).toBe('NO_RESULT');
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('requires allowlisted authority and accepts official collections', async () => {
    const fetchImpl = vi.fn();
    const port = createOfficialDomainDiscoveryPort({
      allowedDomains: ['other.example'],
      authorities: [authority],
      fetchImpl,
    });
    expect((await port.search(request)).status).toBe('NO_RESULT');
    expect(fetchImpl).not.toHaveBeenCalled();
    const collection = createOfficialDomainDiscoveryPort({
      allowedDomains: ['brand.example'],
      authorities: [{ ...authority, role: 'OFFICIAL_PRODUCT_COLLECTION' }],
      fetchImpl: async () => new Response(urlset(product)),
    });
    expect((await collection.search(request)).status).toBe('SUCCESS');
  });

  it('fails closed on generic paths, stopwords, partial SKUs and unmatched retrieval', async () => {
    const { port } = fixture({
      'https://brand.example/sitemap.xml': urlset(
        'https://brand.example/products/',
        'https://brand.example/products/con-de-del-la-el-las-los-y-para-por',
        'https://brand.example/products/agua',
        'https://brand.example/products/bc-0670',
        'https://brand.example/products/xbc-067',
      ),
    });
    expect(await port.search(request)).toMatchObject({ status: 'NO_RESULT', data: [] });
  });

  it('ranks exact normalized SKU first, then product paths and meaningful name tokens', async () => {
    const skuOnly = 'https://brand.example/products/BC067';
    const nameOnly = 'https://brand.example/products/agua-de-rosas';
    const article = 'https://brand.example/blog/agua-de-rosas';
    const { port } = fixture({
      'https://brand.example/sitemap.xml': urlset(article, nameOnly, skuOnly, product),
    });
    expect((await port.search(request)).data?.map((item) => item.uri)).toEqual([
      product,
      skuOnly,
      nameOnly,
      article,
    ]);
  });

  it('deduplicates, breaks index cycles, caps sitemaps at 12 and results at 8', async () => {
    const maps = Array.from({ length: 30 }, (_, i) => `https://brand.example/map-${i}.xml`);
    const documents = Object.fromEntries(
      maps.map((uri) => [uri, urlset(...Array.from({ length: 20 }, (_, i) => `${product}-${i}`))]),
    );
    const { port, fetchImpl } = fixture({
      ...documents,
      'https://brand.example/sitemap.xml': index('https://brand.example/sitemap.xml', ...maps),
    });
    expect((await port.search(request)).data).toHaveLength(8);
    expect(fetchImpl).toHaveBeenCalledTimes(13); // robots plus 12 sitemaps, globally.
    expect(new Set(fetchImpl.mock.calls.map(([uri]) => uri)).size).toBe(13);
  });

  it('never follows redirects or HTML links', async () => {
    const { port, fetchImpl } = fixture({
      'https://brand.example/robots.txt': new Response('', {
        status: 302,
        headers: { Location: 'https://evil.example/map.xml' },
      }),
      'https://brand.example/sitemap.xml': `<html><a href="${product}">Product</a><loc>${product}</loc></html>`,
    });
    expect((await port.search(request)).status).toBe('NO_RESULT');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('decodes XML entities and CDATA but ignores extension locations and DTDs', async () => {
    const { port } = fixture({
      'https://brand.example/sitemap.xml': `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc><![CDATA[${product}]]></loc><image:loc>https://evil.example/p.jpg</image:loc></url><url><loc>${product}?a=1&amp;b=2</loc></url></urlset>`,
    });
    expect((await port.search(request)).data?.map((item) => item.uri)).toEqual([
      product,
      `${product}?a=1&b=2`,
    ]);
    const unsafe = fixture({
      'https://brand.example/sitemap.xml': `<!DOCTYPE urlset [<!ENTITY x SYSTEM "https://evil.example">]>${urlset(product)}`,
    });
    expect((await unsafe.port.search(request)).status).toBe('NO_RESULT');
  });

  it.each([true, false])('rejects oversized bodies (declared length: %s)', async (declared) => {
    const response = new Response(urlset(product) + ' '.repeat(1_000_001), {
      headers: declared ? { 'content-length': '1000100' } : {},
    });
    const { port } = fixture({ 'https://brand.example/sitemap.xml': response });
    expect((await port.search(request)).status).toBe('NO_RESULT');
  });

  it('times out each request after 8 seconds and fails closed', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(() => new Promise<Response>(() => undefined));
    const port = createOfficialDomainDiscoveryPort({
      allowedDomains: ['brand.example'],
      authorities: [authority],
      fetchImpl,
    });
    const pending = port.search(request);
    await vi.advanceTimersByTimeAsync(16_000);
    expect((await pending).status).toBe('NO_RESULT');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
