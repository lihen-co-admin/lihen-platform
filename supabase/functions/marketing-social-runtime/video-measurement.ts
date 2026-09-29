// Bounded ISO-BMFF/QuickTime sample-table measurement. No client duration is used.
// Only unfragmented MP4/MOV with consistent track/sample timelines are supported.
// Unsupported layouts fail closed (including edit lists and fragmented movies).
export const VIDEO_BYTE_LIMIT = 104857600;
export interface VideoMeasurement {
  durationSeconds: number;
  bytes: number;
  etag: string;
  sha256: string;
  method: 'ISO_BMFF_SAMPLE_TABLES_V1';
}
type Box = { type: string; start: number; end: number };
export function measureMovie(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const invalid = (): never => { throw new Error('SOCIAL_VIDEO_DURATION_UNAVAILABLE'); };
  if (bytes.length < 32 || bytes.length > VIDEO_BYTE_LIMIT) invalid();
  let budget = 10000;
  const u32 = (p: number, end = bytes.length) => {
    if (p < 0 || p + 4 > end) invalid();
    return view.getUint32(p);
  };
  const u64 = (p: number, end: number) => {
    const value = u32(p, end) * 4294967296 + u32(p + 4, end);
    if (!Number.isSafeInteger(value)) invalid();
    return value;
  };
  const text = (p: number) => String.fromCharCode(...bytes.subarray(p, p + 4));
  const boxes = (start: number, end: number): Box[] => {
    const result: Box[] = [];
    while (start < end) {
      if (--budget < 0 || start + 8 > end) invalid();
      let size = u32(start, end), header = 8;
      if (size === 1) { size = u64(start + 8, end); header = 16; }
      // Size-zero atoms and ambiguous/truncated layouts are deliberately unsupported.
      if (size < header || start + size > end) invalid();
      result.push({ type: text(start + 4), start: start + header, end: start + size });
      start += size;
    }
    return result;
  };
  const one = (list: Box[], type: string): Box => {
    const matches = list.filter(b => b.type === type);
    if (matches.length !== 1) invalid();
    return matches[0]!;
  };
  const children = (box: Box) => boxes(box.start, box.end);
  const timeline = (box: Box) => {
    const version = bytes[box.start];
    if (version !== 0 && version !== 1) invalid();
    const scaleOffset = box.start + (version === 0 ? 12 : 20);
    const scale = u32(scaleOffset, box.end);
    const duration = version === 0 ? u32(scaleOffset + 4, box.end) : u64(scaleOffset + 4, box.end);
    if (!scale || !duration || duration === 0xffffffff) invalid();
    return { scale, duration };
  };
  const top = boxes(0, bytes.length);
  const ftyp = one(top, 'ftyp');
  if (ftyp.end - ftyp.start < 8 || top.some(b => b.type === 'moof')) invalid();
  const movie = children(one(top, 'moov'));
  if (movie.some(b => b.type === 'mvex')) invalid();
  const movieTime = timeline(one(movie, 'mvhd'));
  const mediaBytes = top.filter(b => b.type === 'mdat').reduce((sum,b) => sum + b.end - b.start, 0);
  if (!mediaBytes) invalid();
  const tracks = movie.filter(b => b.type === 'trak');
  if (!tracks.length || tracks.length > 8) invalid();
  let videoTracks = 0, maxSeconds = 0, totalSampleBytes = 0;
  for (const track of tracks) {
    const trackBoxes = children(track);
    if (trackBoxes.some(b => b.type === 'edts')) invalid();
    const mdia = children(one(trackBoxes, 'mdia'));
    const handler = one(mdia, 'hdlr');
    if (handler.start + 12 > handler.end) invalid();
    const kind = text(handler.start + 8);
    if (!['vide','soun'].includes(kind)) invalid();
    if (kind === 'vide') videoTracks++;
    const time = timeline(one(mdia, 'mdhd'));
    const table = children(one(children(one(mdia, 'minf')), 'stbl'));
    const stts = one(table, 'stts');
    if (u32(stts.start, stts.end) !== 0) invalid();
    const entries = u32(stts.start + 4, stts.end);
    if (!entries || entries > 100000 || stts.start + 8 + entries * 8 !== stts.end) invalid();
    let ticks = 0, samples = 0;
    for (let i = 0; i < entries; i++) {
      const count = u32(stts.start + 8 + i * 8, stts.end);
      const delta = u32(stts.start + 12 + i * 8, stts.end);
      if (!count || !delta) invalid();
      ticks += count * delta; samples += count;
      if (!Number.isSafeInteger(ticks) || samples > 1000000) invalid();
    }
    if (ticks !== time.duration) invalid();
    const sizes = one(table, 'stsz');
    const fixedSize = u32(sizes.start + 4, sizes.end);
    if (u32(sizes.start, sizes.end) !== 0 || u32(sizes.start + 8, sizes.end) !== samples) invalid();
    if (sizes.start + 12 + (fixedSize ? 0 : samples * 4) !== sizes.end) invalid();
    if (fixedSize) totalSampleBytes += samples * fixedSize;
    else for (let i = 0; i < samples; i++) {
      const size = u32(sizes.start + 12 + i * 4, sizes.end);
      if (!size) invalid();
      totalSampleBytes += size;
    }
    const seconds = ticks / time.scale;
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86400) invalid();
    maxSeconds = Math.max(maxSeconds, seconds);
  }
  if (videoTracks !== 1 || totalSampleBytes > mediaBytes || !totalSampleBytes) invalid();
  // Movie and sample-table timelines must agree within one movie tick.
  if (Math.abs(movieTime.duration / movieTime.scale - maxSeconds) > 1 / movieTime.scale) invalid();
  return maxSeconds;
}

export function governedVideoUrl(publicUrl: string, storageOrigin: string, verifiedPrefix: string): URL {
  const url = new URL(publicUrl), origin = new URL(storageOrigin), prefix = new URL(verifiedPrefix);
  if (url.protocol !== 'https:' || origin.protocol !== 'https:' || url.origin !== origin.origin ||
      prefix.origin !== origin.origin || !prefix.pathname.endsWith('/') || prefix.search || prefix.hash || prefix.username || prefix.password ||
      url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix.pathname) ||
      !/^\/storage\/v1\/object\/public\/lihen-editorial-video\/products\/[0-9a-f-]{36}\/reels\/[0-9a-f-]{36}\.(mp4|mov)$/.test(url.pathname))
    throw new Error('SOCIAL_VIDEO_BOUNDARY_VIOLATION');
  return url;
}

export async function measureGovernedVideo(publicUrl: string, storageOrigin: string, verifiedPrefix: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<VideoMeasurement> {
  const url = governedVideoUrl(publicUrl, storageOrigin, verifiedPrefix);
  const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
  const response = await request(url, { method: 'GET', redirect: 'error', signal: boundedSignal, headers: { 'Accept-Encoding': 'identity' } });
  const length = Number(response.headers.get('content-length'));
  const etag = response.headers.get('etag') ?? '';
  if (response.status !== 200 || response.redirected || !response.body || !Number.isSafeInteger(length) || length <= 0 || length > VIDEO_BYTE_LIMIT ||
      !/^"[^"\r\n]+"$/.test(etag) || (response.headers.get('content-encoding') && response.headers.get('content-encoding') !== 'identity') ||
      !['video/mp4','video/quicktime'].includes(response.headers.get('content-type')?.split(';')[0]?.trim() ?? '')) {
    await response.body?.cancel();
    throw new Error('SOCIAL_VIDEO_MEASUREMENT_UNAVAILABLE');
  }
  const bytes = new Uint8Array(length), reader = response.body.getReader();
  let offset = 0;
  try {
    while (true) {
      boundedSignal.throwIfAborted();
      const next = await reader.read();
      if (next.done) break;
      if (offset + next.value.length > length) throw new Error('SOCIAL_VIDEO_SIZE_INVALID');
      bytes.set(next.value, offset); offset += next.value.length;
    }
    if (offset !== length) throw new Error('SOCIAL_VIDEO_TRUNCATED');
    const durationSeconds = measureMovie(bytes);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return { durationSeconds, bytes: length, etag, sha256: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join(''), method: 'ISO_BMFF_SAMPLE_TABLES_V1' };
  } finally { await reader.cancel(); reader.releaseLock(); }
}
