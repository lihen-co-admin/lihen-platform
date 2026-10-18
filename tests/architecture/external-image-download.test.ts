import { describe, expect, it, vi } from 'vitest';
import {
  downloadOfficialImage,
  publicImageAddress,
  officialImageUrl,
  inspectExternalPng,
  type ImageTransport,
} from '../../supabase/functions/intelligence-runtime/external-image-download';

export function pngEnvelope() {
  const b = new Uint8Array(45);
  b.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const v = new DataView(b.buffer);
  v.setUint32(8, 13);
  b.set([73, 72, 68, 82], 12);
  v.setUint32(16, 600);
  v.setUint32(20, 600);
  b.set([73, 69, 78, 68], 37);
  return b;
}
const fixture = () => {
  const close = vi.fn(),
    open = vi.fn(async () => ({
      status: 200,
      mime: 'image/png',
      encoding: 'identity',
      length: 45,
      body: (async function* () {
        yield pngEnvelope();
      })(),
      close,
    }));
  return { io: { resolve: vi.fn(async () => ['8.8.8.8']), open } satisfies ImageTransport, close };
};
describe('pinned official external image transport', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '::1',
    '::ffff:8.8.8.8',
  ])('rejects special address %s', (ip) => expect(publicImageAddress(ip)).toBe(false));
  it.each([
    'http://official.example/a',
    'https://evil.example/a',
    'https://official.example.evil/a',
    'https://user@official.example/a',
    'https://official.example:8443/a',
    'https://official.example/a#fragment',
    'https://127.0.0.1/a',
  ])('rejects unapproved URL %s', (u) =>
    expect(() => officialImageUrl(u, 'official.example')).toThrow(),
  );
  it('pins the resolved public IP and accepts only static PNG envelope', async () => {
    const { io, close } = fixture();
    expect(
      await downloadOfficialImage('https://official.example/a', 'official.example', io),
    ).toEqual(pngEnvelope());
    expect(io.open).toHaveBeenCalledWith(expect.any(URL), '8.8.8.8', expect.any(AbortSignal));
    expect(close).toHaveBeenCalled();
  });
  it('rejects mixed public/private DNS results before any connection', async () => {
    const { io } = fixture();
    io.resolve.mockResolvedValue(['8.8.8.8', '127.0.0.1']);
    await expect(
      downloadOfficialImage('https://official.example/a', 'official.example', io),
    ).rejects.toThrow('SSRF');
    expect(io.open).not.toHaveBeenCalled();
  });
  it.each([301, 302, 307, 308, 404])(
    'rejects HTTP %s without following redirects',
    async (status) => {
      const { io, close } = fixture();
      const original = io.open;
      io.open = vi.fn(async () => ({ ...(await original()), status }));
      await expect(
        downloadOfficialImage('https://official.example/a', 'official.example', io),
      ).rejects.toThrow('HTTP_OR_REDIRECT');
      expect(close).toHaveBeenCalled();
    },
  );
  it('limits bytes even without content-length', async () => {
    const { io } = fixture();
    const original = io.open;
    io.open = vi.fn(async () => ({
      ...(await original()),
      length: 0,
      body: (async function* () {
        yield new Uint8Array(12 * 1024 * 1024 + 1);
      })(),
    }));
    await expect(
      downloadOfficialImage('https://official.example/a', 'official.example', io),
    ).rejects.toThrow('TOO_LARGE');
  });
  it('rejects invalid files and oversized decoded dimensions', () => {
    expect(() => inspectExternalPng(new Uint8Array(50))).toThrow();
    const b = pngEnvelope();
    new DataView(b.buffer).setUint32(16, 100000);
    expect(() => inspectExternalPng(b)).toThrow('DIMENSIONS');
  });
});
