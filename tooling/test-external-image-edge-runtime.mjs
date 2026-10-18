/* Test only: official local Edge Runtime, synthetic PNGs, no Supabase env/credentials. */
/* global AbortSignal */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import assert from 'node:assert/strict';
const image = 'public.ecr.aws/supabase/edge-runtime:v1.76.2';
const name = `lihen-webp-proof-${Date.now()}`;
const output = resolve('.external-image-edge-proof');
mkdirSync(output, { recursive: true });
for (const file of ['results.json', 'runtime.log', 'function.eszip']) {
  const prior = resolve(output, file);
  if (existsSync(prior)) copyFileSync(prior, resolve(output, `${file}.prior-${Date.now()}`));
}
const docker = (args) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
const mounts = [
  '--workdir',
  '/',
  '--mount',
  `type=bind,source=${resolve('supabase/functions/intelligence-runtime')},target=/workspace/supabase/functions/intelligence-runtime,readonly`,
  '--mount',
  `type=bind,source=${resolve('tooling/external-image-edge-proof')},target=/workspace/tooling/external-image-edge-proof,readonly`,
  '--mount',
  `type=bind,source=${output},target=/proof`,
  '--env',
  'DENO_DIR=/proof/cache',
];
function crc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(tag, bytes) {
  const r = Buffer.alloc(bytes.length + 12);
  r.writeUInt32BE(bytes.length);
  r.write(tag, 4);
  r.set(bytes, 8);
  r.writeUInt32BE(crc(r.subarray(4, bytes.length + 8)), bytes.length + 8);
  return r;
}
function png(size, noise = false) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  const data = Buffer.alloc(size * (size * 3 + 1));
  let state = 123456;
  for (let y = 0; y < size; y++) {
    for (let x = 1; x <= size * 3; x++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      data[y * (size * 3 + 1) + x] = noise ? state >>> 24 : 127;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(data)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
let started = false;
const results = [];
try {
  const bundle = docker([
    'run',
    '--rm',
    '--pull=never',
    ...mounts,
    image,
    'bundle',
    '--entrypoint',
    '/workspace/tooling/external-image-edge-proof/function/index.ts',
    '--output',
    '/proof/function.eszip',
  ]);
  writeFileSync(resolve(output, 'bundle.log'), bundle);
  docker([
    'run',
    '-d',
    '--pull=never',
    '--name',
    name,
    '-p',
    '127.0.0.1:58439:9000',
    ...mounts,
    image,
    'start',
    '--main-service',
    '/workspace/tooling/external-image-edge-proof/main',
    '--policy',
    'per_request',
  ]);
  started = true;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch('http://127.0.0.1:58439/ready')).ok) break;
    } catch {
      /* The local test listener is still booting. */
    }
    if (i === 59) throw Error('Edge startup timeout');
    await delay(500);
  }
  for (const [label, input, success] of [
    ['small', png(600), true],
    ['noise', png(600, true), true],
    ['budget-boundary', png(1000, true), true],
    ['too-many-pixels', png(1400), false],
    ['invalid', Buffer.from([1, 2, 3]), false],
  ]) {
    const response = await fetch('http://127.0.0.1:58439/convert', {
      method: 'POST',
      body: input,
      signal: AbortSignal.timeout(120000),
    });
    const body = await response.json();
    results.push({ label, status: response.status, ...body });
    assert.equal(response.status, success ? 200 : 422, JSON.stringify(body));
    assert.equal(body.workerApi, 'undefined', 'Must run in the actual Worker-less user isolate');
    if (success) {
      assert.equal(body.webp, 'WEBP');
      assert(body.elapsedMs < 1500);
    }
  }
  writeFileSync(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        status: 'PASS',
        image,
        packagedEszip: true,
        eszipBytes: statSync(resolve(output, 'function.eszip')).size,
        userIsolate: true,
        cpuHardLimitMs: 2000,
        memoryLimitMb: 256,
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status: 'PASS', checks: results.length, image, results }));
} catch (error) {
  writeFileSync(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        status: 'NO_APTO',
        image,
        packagedEszip: started,
        cpuHardLimitMs: 2000,
        memoryLimitMb: 256,
        error: String(error),
        results,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (started) {
    const logs = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
    writeFileSync(resolve(output, 'runtime.log'), (logs.stdout ?? '') + (logs.stderr ?? ''));
    docker(['rm', '-f', name]);
  }
}
