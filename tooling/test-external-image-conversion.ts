/** Deno runtime acceptance: a generated solid-color PNG, never a commercial product image. */
import { deflateSync } from 'node:zlib';
import { convertExternalPng } from '../supabase/functions/intelligence-runtime/external-image-conversion.ts';
import {
  ingestAuthorizedExternalImage,
  type ExternalImageBackend,
} from '../supabase/functions/intelligence-runtime/external-image-ingestion.ts';
import { execFileSync } from 'node:child_process';
function crc(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(tag: string, bytes: Uint8Array): Uint8Array {
  const result = new Uint8Array(bytes.length + 12),
    v = new DataView(result.buffer);
  v.setUint32(0, bytes.length);
  result.set(new TextEncoder().encode(tag), 4);
  result.set(bytes, 8);
  v.setUint32(bytes.length + 8, crc(result.slice(4, bytes.length + 8)));
  return result;
}
const header = new Uint8Array(13);
const view = new DataView(header.buffer);
view.setUint32(0, 600);
view.setUint32(4, 600);
header[8] = 8;
header[9] = 2;
const raw = new Uint8Array(600 * (600 * 3 + 1));
raw.fill(127);
for (let y = 0; y < 600; y++) raw[y * (600 * 3 + 1)] = 0;
const parts = [
  new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', new Uint8Array()),
];
const png = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
let offset = 0;
for (const part of parts) {
  png.set(part, offset);
  offset += part.length;
}
const webp = await convertExternalPng(png);
if (
  webp.width !== 600 ||
  webp.height !== 600 ||
  String.fromCharCode(...webp.bytes.slice(8, 12)) !== 'WEBP'
)
  throw new Error('Real PNG/WebP conversion failed');
let refused = false;
try {
  await convertExternalPng(new Uint8Array([1, 2, 3]));
} catch {
  refused = true;
}
if (!refused) throw new Error('Invalid PNG accepted');
console.log(
  JSON.stringify({
    status: 'PASS',
    checks: 2,
    syntheticOnly: true,
    realDecoder: true,
    width: webp.width,
    height: webp.height,
    webpBytes: webp.bytes.length,
  }),
);

// Optional complete local chain: direct Deno WASM + actual PostgreSQL finalizer, memory Storage
// fixture. This does NOT claim hosted Supabase Storage/Edge acceptance or use real images.
const localDatabase = Deno.env.get('LIHEN_EXTERNAL_IMAGE_TEST_DATABASE');
if (localDatabase) {
  if (!/^lihen_external_images_[0-9]+$/.test(localDatabase))
    throw new Error('Local fixture database required');
  const psql = Deno.env.get('LIHEN_LOCAL_PSQL') ?? 'psql';
  const sql = (q: string) =>
    execFileSync(
      psql,
      [
        '-X',
        '-h',
        '127.0.0.1',
        '-p',
        '56439',
        '-U',
        'postgres',
        '-d',
        localDatabase,
        '-At',
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        '-',
      ],
      { input: q, encoding: 'utf8', env: { ...Deno.env.toObject(), PGCLIENTENCODING: 'UTF8' } },
    ).trim();
  const quote = (v: unknown) => (v === null ? 'null' : "'" + String(v).replaceAll("'", "''") + "'");
  const actor = '00000000-0000-4000-8000-000000000001',
    product = crypto.randomUUID(),
    candidate = crypto.randomUUID(),
    image = crypto.randomUUID();
  sql(
    `insert into products(id,sku,name)values('${product}','SYNTHETIC-CHAIN','Synthetic full-chain fixture')`,
  );
  const sourceHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', png)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  const binding = {
    productId: product,
    sku: 'SYNTHETIC-CHAIN',
    reference: 'synthetic-reference',
    presentation: 'synthetic-10ml',
    tone: 'synthetic-tone',
    variant: 'synthetic-variant',
    productVersion: sql(`select updated_at::text from products where id='${product}'`),
    candidateId: candidate,
    operationKey: 'synthetic-chain',
    actorId: actor,
    sourceUrl: 'https://official.example/synthetic.png',
    sourceSha256: sourceHash,
  };
  const expiresAt = '2099-01-01';
  const evidence = {
    binding,
    revision: 'chain-r1',
    sourcePageUrl: 'https://official.example/product',
    authority: {
      host: 'official.example',
      evidenceId: 'official-evidence',
      expiresAt,
      revoked: false,
    },
    rights: { documentId: 'chain-license', commercialUse: true, expiresAt, revoked: false },
    approval: { id: 'chain-approval', reviewerId: actor, binding, expiresAt, revoked: false },
    exactIdentityEvidenceId: 'fixture://identity',
    authenticPhotographEvidenceId: 'fixture://authentic',
    contradictions: [],
    role: 'FRONT',
  };
  sql(
    `insert into lihen_private.external_image_rights values('chain-license','fixture://license','${'d'.repeat(64)}','${product}','${sourceHash}',true,'2099-01-01',false)`,
  );
  sql(
    `select public.approve_external_image_authorization(${quote(JSON.stringify(evidence))}::jsonb,'${image}')`,
  );
  const objects = new Map<string, Uint8Array>();
  let downloads = 0,
    uploads = 0;
  const client: ExternalImageBackend = {
    rpc: async (name, args) => {
      const keys =
        name === 'read_external_image_authorization'
          ? ['p_candidate_id', 'p_operation_key', 'p_actor_id']
          : name === 'finalize_external_product_webp'
            ? [
                'p_candidate_id',
                'p_operation_key',
                'p_actor_id',
                'p_evidence_revision',
                'p_sha256',
                'p_byte_size',
                'p_width',
                'p_height',
              ]
            : null;
      if (!keys) throw new Error('Unexpected local RPC');
      try {
        return {
          data: JSON.parse(
            sql(`select public.${name}(${keys.map((k) => quote(args[k])).join(',')})`),
          ),
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },
    storage: {
      from: (bucket) => {
        if (bucket !== 'lihen-product-web') throw new Error('Unexpected bucket');
        return {
          upload: async (path, bytes) => {
            uploads++;
            if (objects.has(path)) return { error: 'already exists' };
            objects.set(path, Uint8Array.from(bytes));
            sql(
              `insert into storage.objects values('lihen-product-web',${quote(path)},${quote(JSON.stringify({ mimetype: 'image/webp', size: bytes.length }))}::jsonb)`,
            );
            return { error: null };
          },
          download: async (path) => ({
            data: objects.has(path) ? new Blob([Uint8Array.from(objects.get(path)!)]) : null,
            error: null,
          }),
        };
      },
    },
  };
  const input = {
    projectUrl: 'https://vnmkupzptujtywnnabkp.supabase.co',
    actorId: actor,
    candidateId: candidate,
    operationKey: 'synthetic-chain',
    client,
    convert: convertExternalPng,
    retrieve: async () => {
      downloads++;
      return png;
    },
  };
  const created = (await ingestAuthorizedExternalImage(input)) as Record<string, unknown>;
  const replay = (await ingestAuthorizedExternalImage(input)) as Record<string, unknown>;
  if (created.imageId !== image || replay.replayed !== true || downloads !== 1 || uploads !== 1)
    throw new Error('Full-chain/replay mismatch');
  if (sql(`select source_type from product_images where id='${image}'`) !== 'VERIFIED_EXTERNAL')
    throw new Error('Origin mismatch');
  sql(`select public.revoke_external_image_authorization('${candidate}')`);
  let blocked = false;
  try {
    await ingestAuthorizedExternalImage(input);
  } catch {
    blocked = true;
  }
  if (!blocked) throw new Error('Revoked full-chain operation accepted');
  console.log(
    JSON.stringify({
      status: 'PASS',
      fullLocalChain: true,
      checks: 4,
      realDecoder: true,
      realPostgres: true,
      storage: 'MEMORY_FIXTURE_NOT_HOSTED',
      sourceDownloads: downloads,
      uploads,
      syntheticOnly: true,
    }),
  );
}
