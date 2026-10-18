import { MAX_EXTERNAL_BYTES, inspectExternalPng } from './external-image-png.ts';
export { MAX_EXTERNAL_BYTES, inspectExternalPng } from './external-image-png.ts';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

/** IPv4-only egress is intentional. Reject all special-use ranges and IPv6, including mapped IPs. */
export function publicImageAddress(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split('.').map(Number);
  return !(
    [0, 10, 127].includes(a!) ||
    a! >= 224 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && [0, 2, 88, 168].includes(b!)) ||
    (a === 198 && [18, 19, 51].includes(b!)) ||
    (a === 203 && b === 0)
  );
}
export function officialImageUrl(raw: string, host: string): URL {
  const u = new URL(raw);
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.hash ||
    u.port ||
    isIP(u.hostname) ||
    !/^[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(host) ||
    u.hostname !== host ||
    host.includes('..') ||
    host.endsWith('.local') ||
    host.endsWith('.localhost')
  ) {
    throw new Error('EXTERNAL_IMAGE_OFFICIAL_URL_REQUIRED');
  }
  return u;
}
export interface PinnedImageResponse {
  status: number;
  mime: string;
  encoding: string;
  length: number;
  body: AsyncIterable<Uint8Array>;
  close(): void;
}
export interface ImageTransport {
  resolve(host: string): Promise<readonly string[]>;
  open(url: URL, address: string, signal: AbortSignal): Promise<PinnedImageResponse>;
}
/** TLS still validates the ORIGINAL host/SNI; only the socket lookup is pinned. No proxy or pool. */
const transport: ImageTransport = {
  resolve: async (host) =>
    (await lookup(host, { all: true, family: 4, verbatim: true })).map((r) => r.address),
  open: (url, address, signal) =>
    new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          agent: false,
          signal,
          rejectUnauthorized: true,
          servername: url.hostname,
          family: 4,
          lookup: (_host, _opts, callback) => callback(null, address, 4),
          headers: { Accept: 'image/png', 'Accept-Encoding': 'identity' },
        },
        (res) => {
          resolve({
            status: res.statusCode ?? 0,
            mime: String(res.headers['content-type'] ?? '')
              .split(';')[0]!
              .trim()
              .toLowerCase(),
            encoding: String(res.headers['content-encoding'] ?? 'identity'),
            length: Number(res.headers['content-length'] ?? 0),
            body: res,
            close: () => res.destroy(),
          });
        },
      );
      req.on('error', reject);
      req.end();
    }),
};
export async function downloadOfficialImage(
  raw: string,
  host: string,
  io: ImageTransport = transport,
): Promise<Uint8Array> {
  const url = officialImageUrl(raw, host),
    controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 10_000);
  const aborted = new Promise<never>((_resolve, reject) =>
    controller.signal.addEventListener('abort', () => reject(new Error('EXTERNAL_IMAGE_TIMEOUT')), {
      once: true,
    }),
  );
  let response: PinnedImageResponse | undefined;
  try {
    const addresses = await Promise.race([io.resolve(host), aborted]);
    if (!addresses.length || addresses.some((a) => !publicImageAddress(a)))
      throw new Error('EXTERNAL_IMAGE_SSRF_BLOCKED');
    response = await Promise.race([io.open(url, addresses[0]!, controller.signal), aborted]);
    if (response.status !== 200) throw new Error('EXTERNAL_IMAGE_HTTP_OR_REDIRECT_BLOCKED');
    if (response.mime !== 'image/png' || response.encoding !== 'identity')
      throw new Error('EXTERNAL_IMAGE_FORMAT_BLOCKED');
    if (
      !Number.isFinite(response.length) ||
      response.length < 0 ||
      response.length > MAX_EXTERNAL_BYTES
    )
      throw new Error('EXTERNAL_IMAGE_TOO_LARGE');
    const chunks: Uint8Array[] = [];
    let total = 0;
    const iterator = response.body[Symbol.asyncIterator]();
    while (true) {
      const item = await Promise.race([iterator.next(), aborted]);
      if (item.done) break;
      total += item.value.length;
      if (total > MAX_EXTERNAL_BYTES) throw new Error('EXTERNAL_IMAGE_TOO_LARGE');
      chunks.push(Uint8Array.from(item.value));
    }
    if (response.length && response.length !== total) throw new Error('EXTERNAL_IMAGE_TRUNCATED');
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    inspectExternalPng(bytes);
    return bytes;
  } finally {
    clearTimeout(deadline);
    controller.abort();
    response?.close();
  }
}
