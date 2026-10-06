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
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://brand.example/product',
      expect.objectContaining({ redirect: 'manual' }),
    );
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

  it.each([1_270_996, 2 * 1024 * 1024])('accepts %i bytes with the default limit', async (size) => {
    const text = 'x'.repeat(size);
    const response = new Response(text, {
      headers: { 'Content-Type': 'text/html', 'Content-Length': String(size) },
    });
    const arrayBuffer = vi.spyOn(response, 'arrayBuffer');
    const result = await fetchEditorialEvidenceDocument('https://brand.example/product', {
      fetchImpl: vi.fn().mockResolvedValue(response),
      allowedDomains: ['brand.example'],
    });

    expect(result.text).toBe(text);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('rejects Content-Length above 2 MiB before reading the body', async () => {
    const response = new Response('small fixture', {
      headers: { 'Content-Type': 'text/plain', 'Content-Length': String(2 * 1024 * 1024 + 1) },
    });
    const getReader = vi.spyOn(response.body!, 'getReader');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(
      fetchEditorialEvidenceDocument('https://brand.example/product', {
        fetchImpl,
        allowedDomains: ['brand.example'],
      }),
    ).rejects.toThrow('EDITORIAL_EVIDENCE_DOCUMENT_TOO_LARGE');

    expect(getReader).not.toHaveBeenCalled();
    expect(fetchImpl.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  });

  it.each([undefined, '1'])(
    'cancels an oversized stream with Content-Length %s',
    async (declaredLength) => {
      const cancel = vi.fn();
      const pull = vi.fn((controller: ReadableStreamDefaultController<Uint8Array>) => {
        controller.enqueue(new Uint8Array(256 * 1024));
      });
      const response = new Response(new ReadableStream({ pull, cancel }, { highWaterMark: 0 }), {
        headers: {
          'Content-Type': 'text/plain',
          ...(declaredLength === undefined ? {} : { 'Content-Length': declaredLength }),
        },
      });
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

      await expect(
        fetchEditorialEvidenceDocument('https://brand.example/product', {
          fetchImpl,
          allowedDomains: ['brand.example'],
        }),
      ).rejects.toThrow('EDITORIAL_EVIDENCE_DOCUMENT_TOO_LARGE');

      expect(pull).toHaveBeenCalledTimes(9);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(response.body!.locked).toBe(false);
      expect(fetchImpl.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    },
  );

  it.each([null, '', '   '])('rejects empty documents (%s)', async (body) => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(body, {
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
