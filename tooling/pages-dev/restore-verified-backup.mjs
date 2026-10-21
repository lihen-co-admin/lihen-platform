import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export const BACKUP_SHA256 = '3c72ef792bc56cba30c210b4a0e0ef7d04ea4b258bd4c8934bfd361f7c84fb7c';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const fail = (code) => {
  throw new Error(code);
};
export function readBackup(zip, expected = BACKUP_SHA256) {
  if (hash(zip) !== expected) fail('BACKUP_SHA256_MISMATCH');
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--)
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0 || zip.readUInt16LE(end + 8) !== 1 || zip.readUInt16LE(end + 10) !== 1)
    fail('ZIP_SINGLE_TAR_REQUIRED');
  const c = zip.readUInt32LE(end + 16);
  if (zip.readUInt32LE(c) !== 0x02014b50) fail('ZIP_INVALID');
  const flags = zip.readUInt16LE(c + 8),
    method = zip.readUInt16LE(c + 10),
    size = zip.readUInt32LE(c + 20),
    raw = zip.readUInt32LE(c + 24),
    offset = zip.readUInt32LE(c + 42);
  const name = zip.subarray(c + 46, c + 46 + zip.readUInt16LE(c + 28)).toString();
  if (name !== 'artifact.tar' || flags & 1 || raw > 536870912 || ![0, 8].includes(method))
    fail('ZIP_UNSUPPORTED');
  if (zip.readUInt32LE(offset) !== 0x04034b50) fail('ZIP_LOCAL_HEADER_INVALID');
  const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
  if (start + size > c) fail('ZIP_BOUNDS');
  const data = zip.subarray(start, start + size),
    tar = method === 0 ? data : inflateRawSync(data, { maxOutputLength: 536870912 });
  if (tar.length !== raw) fail('ZIP_SIZE_MISMATCH');
  const text = (b, a, n) =>
    b
      .subarray(a, a + n)
      .toString('utf8')
      .replace(/\0.*$/s, '');
  const number = (s) => {
    if (!/^[0-7]*$/.test(s.trim())) fail('TAR_NUMBER_INVALID');
    return parseInt(s.trim() || '0', 8);
  };
  const files = new Map();
  let pax = {};
  let total = 0;
  let ended = false;
  for (let p = 0; p + 512 <= tar.length;) {
    const h = tar.subarray(p, p + 512);
    if (h.every((n) => n === 0)) {
      ended = true;
      break;
    }
    const checksum = number(text(h, 148, 8));
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : h[i];
    if (sum !== checksum) fail('TAR_CHECKSUM_INVALID');
    const len = number(text(h, 124, 12)),
      type = text(h, 156, 1),
      prefix = text(h, 345, 155),
      rawName = (prefix ? prefix + '/' : '') + text(h, 0, 100);
    const begin = p + 512;
    if (begin + len > tar.length) fail('TAR_TRUNCATED');
    const body = tar.subarray(begin, begin + len);
    p = begin + Math.ceil(len / 512) * 512;
    if (type === 'x') {
      pax = {};
      let q = 0;
      while (q < body.length) {
        const space = body.indexOf(32, q);
        const count = Number(body.subarray(q, space));
        if (!Number.isInteger(count) || count <= 0 || q + count > body.length)
          fail('TAR_PAX_INVALID');
        const line = body.subarray(space + 1, q + count - 1).toString();
        const eq = line.indexOf('=');
        if (eq < 1) fail('TAR_PAX_INVALID');
        const key = line.slice(0, eq);
        if (!['path', 'mtime', 'atime', 'ctime'].includes(key)) fail('TAR_PAX_UNSUPPORTED');
        pax[key] = line.slice(eq + 1);
        q += count;
      }
      continue;
    }
    const path = (pax.path ?? rawName).replace(/^(\.\/)+/, '').replace(/\/$/, '');
    pax = {};
    if (!path || path === '.') {
      if (type === '5') continue;
      fail('TAR_ROOT_INVALID');
    }
    if (
      path.startsWith('/') ||
      path.includes('\\') ||
      path.split('/').some((x) => !x || x === '.' || x === '..') ||
      [...path].some((c) => c.charCodeAt(0) < 32) ||
      path.includes(':')
    )
      fail('TAR_PATH_UNSAFE');
    if (type === '5') continue;
    if (type !== '' && type !== '0') fail('TAR_LINK_OR_TYPE_BLOCKED');
    if (files.has(path)) fail('TAR_DUPLICATE');
    total += len;
    if (total > 536870912 || files.size > 20000) fail('TAR_LIMIT');
    files.set(path, Buffer.from(body));
  }
  if (!ended || !files.has('control-center/index.html') || !files.has('storefront/index.html'))
    fail('BOTH_SITES_REQUIRED');
  return { files, tarSha256: hash(tar) };
}
export function restoreBackup(backup, output) {
  const result = readBackup(readFileSync(backup));
  const target = resolve(output);
  if (existsSync(target)) fail('OUTPUT_ALREADY_EXISTS');
  mkdirSync(target, { recursive: true });
  for (const [name, bytes] of result.files) {
    const dest = join(target, name);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, bytes);
  }
  const manifest = {
    stage: 'VERIFIED_RECOVERY',
    sourceCommit: '3702ee47f89f86525b059465eb5a11e1b3157e9a',
    backupSha256: BACKUP_SHA256,
    tarSha256: result.tarSha256,
    files: [...result.files].map(([path, bytes]) => ({
      path,
      bytes: bytes.length,
      sha256: hash(bytes),
    })),
  };
  writeFileSync(target + '.manifest.json', JSON.stringify(manifest, null, 2));
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2) fail('USAGE_BACKUP_ZIP_OUTPUT_DIRECTORY');
    const m = restoreBackup(...args);
    console.log(
      JSON.stringify({
        status: 'PASS',
        stage: m.stage,
        files: m.files.length,
        backupSha256: m.backupSha256,
        tarSha256: m.tarSha256,
      }),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
