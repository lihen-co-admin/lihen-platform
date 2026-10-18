/* Local-only SQL integration test. Never accepts a remote host or Supabase connection string. */
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const bin = process.env.LIHEN_LOCAL_PSQL ?? 'psql';
const db = `lihen_external_images_${Date.now()}`;
const args = [
  '-X',
  '-h',
  '127.0.0.1',
  '-p',
  '56439',
  '-U',
  'postgres',
  '-v',
  'ON_ERROR_STOP=1',
  '-At',
];
const sql = (q, database = db) =>
  execFileSync(bin, [...args, '-d', database, '-f', '-'], {
    input: q,
    encoding: 'utf8',
    env: { ...process.env, PGCLIENTENCODING: 'UTF8' },
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
sql(`create database ${db}`, 'postgres');
sql(`create schema auth; create schema lihen_private; create schema storage;
do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$;
create table auth.users(id uuid primary key);
create table public.profiles(id uuid primary key,authorization_status text,role_code text);
create table public.brands(id uuid primary key);
create table public.products(id uuid primary key,sku text,name text,updated_at timestamptz not null default now());
create table public.product_variants(id uuid primary key,product_id uuid references public.products(id),variant_code text,presentation text,tone text);
create table public.product_images(id uuid primary key,product_id uuid references public.products(id),public_url text,storage_bucket text,storage_path text,alt_text text,is_main boolean,sort_order integer,source_type text,status text,source_id uuid,asset_role text,derivative_profile text);
create table storage.objects(bucket_id text,name text,metadata jsonb);
`);
// Reuse actual repository table definitions, not an in-memory simulation of the transaction.
const migrations = join(process.cwd(), 'database/migrations');
sql(readFileSync(join(migrations, '20260821151856_product_image_storage_foundation.sql'), 'utf8'));
const source = readFileSync(
  join(migrations, '20260821204612_image_source_quality_provenance_human_fallback_contract.sql'),
  'utf8',
);
sql(source.slice(0, source.indexOf('comment on table')));
sql(`alter table public.product_images drop constraint product_images_source_type_check;
alter table lihen_private.product_image_storage_assets add column rendition_profile text;
alter table public.product_images add foreign key(source_id) references lihen_private.product_image_sources(id);`);
sql(
  readFileSync(
    join(migrations, 'pending/20261017_verified_external_product_images_dev.sql'),
    'utf8',
  ),
);

// Only local fixture schema is expanded; remote Supabase is never contacted.
sql(`alter table products add column status text default 'INACTIVE';
alter table products add column visible_on_website boolean default false;
alter table products add column main_image_url text;
create table public.catalog_entries(id uuid primary key default gen_random_uuid(),product_id uuid references products(id));
create table storage.buckets(id text primary key,public boolean);
insert into storage.buckets values('lihen-product-originals',false);`);
sql(readFileSync(join(migrations, 'pending/20261018_synthetic_image_test_dev.sql'), 'utf8'));
const rawSql = sql;
const devClaims = `set request.jwt.claims='{"ref":"vnmkupzptujtywnnabkp"}';`;
const run = (q) => rawSql(devClaims + q);
const actor = '00000000-0000-4000-8000-000000000001',
  product = '8ebc8ca4-7c42-4e85-b42c-fbb218327101';
run(`insert into auth.users values('${actor}');insert into profiles values('${actor}','ACTIVE','OWNER');
insert into products(id,sku,name) values('${product}','SYNTHETIC-WEBP-DEV-20261017-01','SYNTHETIC ONLY');
insert into lihen_private.external_image_authorities values('controlled.example','synthetic-authority','https://controlled.example/provenance',now()+interval '20 minutes',false);`);
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const version = run(`select updated_at::text from products where id='${product}'`)
  .split('\n')
  .at(-1);
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const sourceHash = '8a2364c06d4a91acf5a65329a5f4a4701cbf911fab22c24d55202f69f1c294a6';
function evidence(n) {
  const expiry = new Date(Date.now() + 10 * 60000).toISOString();
  const binding = {
    productId: product,
    sku: 'SYNTHETIC-WEBP-DEV-20261017-01',
    reference: 'SYNTHETIC',
    presentation: '600x600',
    tone: 'geometric',
    variant: 'synthetic',
    productVersion: version,
    candidateId: id(100 + n),
    operationKey: 'synthetic-' + n,
    actorId: actor,
    sourceUrl: 'https://controlled.example/synthetic.png',
    sourceSha256: sourceHash,
  };
  return {
    mode: 'SYNTHETIC_TEST',
    binding,
    revision: 's1',
    sourcePageUrl: 'https://controlled.example/provenance',
    authority: {
      evidenceId: 'synthetic-authority',
      host: 'controlled.example',
      expiresAt: expiry,
      revoked: false,
    },
    rights: {
      documentId: 'synthetic-' + n,
      commercialUse: false,
      expiresAt: expiry,
      revoked: false,
    },
    approval: {
      id: 'synthetic-approval-' + n,
      reviewerId: actor,
      binding: { ...binding },
      expiresAt: expiry,
      revoked: false,
    },
    synthetic: {
      provenanceDocumentId: 'synthetic-' + n,
      documentSha256: 'd'.repeat(64),
      approvedAt: new Date().toISOString(),
      humanTestApproval: true,
    },
    exactIdentityEvidenceId: '',
    authenticPhotographEvidenceId: '',
    contradictions: [],
    role: 'FRONT',
  };
}
function rights(n) {
  run(
    `insert into lihen_private.external_image_rights values('synthetic-${n}','https://controlled.example/provenance','${'d'.repeat(64)}','${product}','${sourceHash}',false,now()+interval '10 minutes',false)`,
  );
}
const approve = (e, n) =>
  `select public.approve_synthetic_image_authorization(${quote(JSON.stringify(e))}::jsonb,'${id(200 + n)}')`;
let assertions = 0;
function check(v, label) {
  assert.ok(v, label);
  assertions++;
}
function reject(q, label) {
  assert.throws(() => run(q), undefined, label);
  assertions++;
}
const mutations = {
  otherProduct: (e) => {
    e.binding.productId = id(900);
    e.approval.binding.productId = id(900);
  },
  otherHash: (e) => {
    e.binding.sourceSha256 = 'b'.repeat(64);
    e.approval.binding.sourceSha256 = 'b'.repeat(64);
  },
  commercial: (e) => {
    e.rights.commercialUse = true;
  },
  photograph: (e) => {
    e.authenticPhotographEvidenceId = 'fabricated';
  },
  human: (e) => {
    e.synthetic.humanTestApproval = false;
  },
  document: (e) => {
    delete e.synthetic.documentSha256;
  },
  expiry: (e) => {
    e.approval.expiresAt = '2099-01-01';
  },
  revoked: (e) => {
    e.approval.revoked = true;
  },
  binding: (e) => {
    e.approval.binding.sourceUrl = 'https://substitution.example/a';
  },
  mode: (e) => {
    e.mode = 'VERIFIED_EXTERNAL';
  },
};
let n = 0;
for (const [label, mutate] of Object.entries(mutations)) {
  n++;
  rights(n);
  const e = evidence(n);
  mutate(e);
  reject(approve(e, n), label);
}
n++;
rights(n);
const first = evidence(n);
reject(
  `set request.jwt.claims='{"ref":"gqitoossdbiohqegjvlh"}';${approve(first, n)}`,
  'PROD ref rejected',
);
reject(`set request.jwt.claims='{}';${approve(first, n)}`, 'missing project rejected');
run(`update profiles set role_code='VIEWER' where id='${actor}'`);
reject(approve(first, n), 'non-owner denied');
run(`update profiles set role_code='OWNER' where id='${actor}'`);
const asyncExec = promisify(execFile);
const concurrent = (q) =>
  asyncExec(bin, [...args, '-d', db, '-c', devClaims + q], { encoding: 'utf8' });
await Promise.all([concurrent(approve(first, n)), concurrent(approve(first, n))]);
check(
  run(`select count(*) from lihen_private.external_image_authorizations`).split('\n').at(-1) ===
    '1',
  'concurrent approval creates one identity',
);
const hash = 'a'.repeat(64),
  image = id(200 + n),
  candidate = id(100 + n);
const path = `_synthetic_tests/${product}/${image}/web/${hash}.webp`;
const final = `select public.finalize_synthetic_product_webp('${candidate}','synthetic-${n}','${actor}','s1','${hash}',100,600,600)`;
reject(final, 'Storage required');
run(
  `insert into storage.objects values('lihen-product-originals','${path}','{"mimetype":"image/webp","size":100}')`,
);
run(`update storage.buckets set public=true`);
reject(final, 'public bucket refused');
run(`update storage.buckets set public=false`);
const result = await Promise.all([concurrent(final), concurrent(final)]);
const outputs = result.map((r) => JSON.parse(r.stdout.trim().split('\n').at(-1)));
check(outputs.filter((r) => r.replayed).length === 1, 'concurrent finalize one replay');
check(
  outputs.every(
    (r) => r.sourceType === 'SYNTHETIC_TEST' && r.commercialEligible === false && !r.publicUrl,
  ),
  'private synthetic receipt',
);
check(
  run('select count(*) from lihen_private.synthetic_image_test_results').split('\n').at(-1) === '1',
  'one receipt',
);
check(
  run('select count(*) from product_images').split('\n').at(-1) === '0',
  'no commercial gallery',
);
check(
  run('select count(*) from lihen_private.product_image_sources').split('\n').at(-1) === '0',
  'no commercial sources',
);
reject(
  `update products set visible_on_website=true where id='${product}'`,
  'website publication forbidden',
);
reject(`update products set status='ACTIVE' where id='${product}'`, 'activation forbidden');
reject(
  `update products set main_image_url='https://controlled.example/a' where id='${product}'`,
  'main image forbidden',
);
reject(`insert into catalog_entries(product_id) values('${product}')`, 'catalog forbidden');
reject(
  `insert into product_images(id,product_id,source_type,is_main) values('${id(999)}','${product}','VERIFIED_EXTERNAL',true)`,
  'external promotion forbidden',
);
reject(
  `update lihen_private.external_image_authorizations set revoked=true where candidate_id='${candidate}';${final}`,
  'revocation invalidates replay',
);
reject(final.replace("'s1'", "'changed'"), 'uncertain retry must retain revision');
// A second operation cannot turn the single fixed fixture into additional records.
const second = evidence(30);
rights(30);
run(approve(second, 30));
const secondPath = `_synthetic_tests/${product}/${id(230)}/web/${hash}.webp`;
run(
  `insert into storage.objects values('lihen-product-originals','${secondPath}','{"mimetype":"image/webp","size":100}')`,
);
reject(
  `select public.finalize_synthetic_product_webp('${id(130)}','synthetic-30','${actor}','s1','${hash}',100,600,600)`,
  'deduplication across operations',
);
reject(`update products set id='${id(901)}' where id='${product}'`, 'reserved identity immutable');
// Cleanup order is exercised transactionally against the real foreign keys.
run(`begin; delete from lihen_private.synthetic_image_test_results where product_id='${product}';
delete from lihen_private.external_image_authorizations where product_id='${product}';
delete from lihen_private.external_image_rights where product_id='${product}';
delete from products where id='${product}'; rollback;`);
check(
  run(`select count(*) from products where id='${product}'`).split('\n').at(-1) === '1',
  'referential cleanup rehearsal rolled back',
);
const oldSha = readFileSync(
  join(migrations, 'pending/20261017_verified_external_product_images_dev.sql'),
);
check(
  (await import('node:crypto')).createHash('sha256').update(oldSha).digest('hex') ===
    'c2baaaa7e3107fa648b626476c12060f58138244e95c80bbbe4316e1d9c497bf',
  'applied migration intact',
);
for (const role of ['anon', 'authenticated']) {
  check(
    run(
      `select has_function_privilege('${role}','public.approve_synthetic_image_authorization(jsonb,uuid)','EXECUTE')`,
    )
      .split('\n')
      .at(-1) === 'f',
    'RPC denied ' + role,
  );
}
console.log(
  JSON.stringify({
    status: 'PASS',
    assertions,
    host: '127.0.0.1',
    port: 56439,
    database: db,
    remoteConnections: 0,
  }),
);
