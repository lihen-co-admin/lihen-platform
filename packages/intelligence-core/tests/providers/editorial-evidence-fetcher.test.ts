import { describe, expect, it, vi } from 'vitest';
import { fetchEditorialEvidenceDocument } from '../../../../supabase/functions/intelligence-runtime/providers/editorial-evidence-fetcher';

describe('Editorial evidence fetcher', () => {
  it('rejects a public HTTPS domain that is not explicitly authorized', async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchEditorialEvidenceDocument('https://untrusted.example/product', {
        fetchImpl: fetchImpl as typeof fetch,
        allowedDomains: ['brand.example'],
      }),
    ).rejects.toThrow('EDITORIAL_EVIDENCE_DOMAIN_NOT_AUTHORIZED');

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not authorize subdomains implicitly', async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchEditorialEvidenceDocument('https://shop.brand.example/product', {
        fetchImpl: fetchImpl as typeof fetch,
        allowedDomains: ['brand.example'],
      }),
    ).rejects.toThrow('EDITORIAL_EVIDENCE_DOMAIN_NOT_AUTHORIZED');

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    'http://brand.example/product',
    'https://localhost/product',
    'https://127.0.0.1/product',
    'https://10.0.0.1/product',
    'https://192.168.1.1/product',
    'https://172.16.0.1/product',
    'https://169.254.169.254/latest/meta-data',
    'https://user:password@brand.example/product',
    'https://brand.example:8443/product',
  ])('rejects unsafe URL %s before network access', async (url) => {
    const fetchImpl = vi.fn();

    await expect(
      fetchEditorialEvidenceDocument(url, {
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).rejects.toThrow('EDITORIAL_EVIDENCE_URL_NOT_ALLOWED');

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects redirects instead of following them', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          Location: 'https://127.0.0.1/internal',
        },
      }),
    );

    await expect(
      fetchEditorialEvidenceDocument('https://brand.example/product', {
        fetchImpl: fetchImpl as typeof fetch,
        allowedDomains: ['brand.example'],
      }),
    ).rejects.toThrow('EDITORIAL_EVIDENCE_REDIRECT_NOT_ALLOWED');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('accepts bounded HTTPS HTML', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('<html><body>Agua de rosas Marca A BC-067</body></html>', {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }),
    );

    const result = await fetchEditorialEvidenceDocument(
      'https://brand.example/products/rose-water',
      {
        fetchImpl: fetchImpl as typeof fetch,
        allowedDomains: ['brand.example'],
      },
    );

    expect(result).toMatchObject({
      url: 'https://brand.example/products/rose-water',
      domain: 'brand.example',
      contentType: 'text/html',
    });
    expect(result.text).toContain('BC-067');
  });

  it('rejects unsupported content types', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('binary', {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
        },
      }),
    );

    await expect(
      fetchEditorialEvidenceDocument('https://brand.example/catalog.pdf', {
        fetchImpl: fetchImpl as typeof fetch,
        allowedDomains: ['brand.example'],
      }),
    ).rejects.toThrow('EDITORIAL_EVIDENCE_CONTENT_TYPE_NOT_ALLOWED');
  });

  it('rejects oversized declared documents', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('small fixture', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': '999999',
        },
      }),
    );

    await expect(
      fetchEditorialEvidenceDocument('https://brand.example/product', {
        fetchImpl: fetchImpl as typeof fetch,
        maxBytes: 1024,
        allowedDomains: ['brand.example'],
      }),
    ).rejects.toThrow('EDITORIAL_EVIDENCE_DOCUMENT_TOO_LARGE');
  });

  it('rejects oversized actual response bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('x'.repeat(2048), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      }),
    );

    await expect(
      fetchEditorialEvidenceDocument('https://brand.example/product', {
        fetchImpl: fetchImpl as typeof fetch,
        maxBytes: 1024,
        allowedDomains: ['brand.example'],
      }),
    ).rejects.toThrow('EDITORIAL_EVIDENCE_DOCUMENT_TOO_LARGE');
  });

  it('rejects empty documents', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('   ', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      }),
    );

    await expect(
      fetchEditorialEvidenceDocument('https://brand.example/product', {
        fetchImpl: fetchImpl as typeof fetch,
        allowedDomains: ['brand.example'],
      }),
    ).rejects.toThrow('EDITORIAL_EVIDENCE_EMPTY_DOCUMENT');
  });
});
