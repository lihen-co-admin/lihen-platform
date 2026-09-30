export interface EditorialEvidenceFetchOptions {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly allowedDomains?: readonly string[];
}

export interface EditorialEvidenceDocument {
  readonly url: string;
  readonly domain: string;
  readonly retrievedAt: string;
  readonly contentType: string;
  readonly text: string;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 512_000;

function validatePublicHttpsUrl(raw: string): URL {
  const url = new URL(raw);

  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('EDITORIAL_EVIDENCE_URL_NOT_ALLOWED');
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.startsWith('127.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.') ||
    hostname.startsWith('metadata.')
  ) {
    throw new Error('EDITORIAL_EVIDENCE_URL_NOT_ALLOWED');
  }

  const private172 = /^172\.(\d{1,3})\./.exec(hostname);
  if (private172) {
    const second = Number(private172[1]);
    if (second >= 16 && second <= 31) {
      throw new Error('EDITORIAL_EVIDENCE_URL_NOT_ALLOWED');
    }
  }

  return url;
}

export async function fetchEditorialEvidenceDocument(
  rawUrl: string,
  options: EditorialEvidenceFetchOptions = {},
): Promise<EditorialEvidenceDocument> {
  const url = validatePublicHttpsUrl(rawUrl);

  const allowedDomains = (options.allowedDomains ?? [])
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  if (allowedDomains.length === 0 || !allowedDomains.includes(url.hostname.toLowerCase())) {
    throw new Error('EDITORIAL_EVIDENCE_DOMAIN_NOT_AUTHORIZED');
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url.href, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,text/plain;q=0.9',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error('EDITORIAL_EVIDENCE_REDIRECT_NOT_ALLOWED');
    }

    if (!response.ok) {
      throw new Error('EDITORIAL_EVIDENCE_FETCH_FAILED');
    }

    const contentType = (response.headers.get('content-type') ?? '')
      .split(';')[0]!
      .trim()
      .toLowerCase();

    if (contentType !== 'text/html' && contentType !== 'text/plain') {
      throw new Error('EDITORIAL_EVIDENCE_CONTENT_TYPE_NOT_ALLOWED');
    }

    const declaredLength = Number(response.headers.get('content-length') ?? '0');

    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error('EDITORIAL_EVIDENCE_DOCUMENT_TOO_LARGE');
    }

    const bytes = new Uint8Array(await response.arrayBuffer());

    if (bytes.byteLength > maxBytes) {
      throw new Error('EDITORIAL_EVIDENCE_DOCUMENT_TOO_LARGE');
    }

    const text = new TextDecoder('utf-8', {
      fatal: false,
    }).decode(bytes);

    if (!text.trim()) {
      throw new Error('EDITORIAL_EVIDENCE_EMPTY_DOCUMENT');
    }

    return {
      url: url.href,
      domain: url.hostname.toLowerCase(),
      retrievedAt: new Date().toISOString(),
      contentType,
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}
