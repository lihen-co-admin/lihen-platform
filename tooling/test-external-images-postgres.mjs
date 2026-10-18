/* Local-only SQL integration test. Never accepts a remote host or Supabase connection string. */
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
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
const actor = '00000000-0000-4000-8000-000000000001',
  product = '00000000-0000-4000-8000-000000000002';
sql(`insert into auth.users values('${actor}'); insert into profiles values('${actor}','ACTIVE','OWNER');
insert into products(id,sku,name,updated_at) values('${product}','SYNTHETIC-LOCAL','Synthetic local fixture','2026-01-01T00:00:00Z');
insert into lihen_private.external_image_authorities values('official.example','official-evidence','fixture://authority','2099-01-01',false);`);
const version = sql(`select updated_at::text from products where id='${product}'`);
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function evidence(n) {
  const b = {
    productId: product,
    sku: 'SYNTHETIC-LOCAL',
    reference: 'local-ref',
    presentation: 'local-10ml',
    tone: 'local-tone',
    variant: 'local-variant',
    productVersion: version,
    candidateId: uuid(100 + n),
    operationKey: `op-${n}`,
    actorId: actor,
    sourceUrl: `https://official.example/${n}.png`,
    sourceSha256: n.toString(16).padStart(64, '0'),
  };
  return {
    binding: b,
    revision: 'r1',
    sourcePageUrl: 'https://official.example/product',
    authority: {
      evidenceId: 'official-evidence',
      host: 'official.example',
      expiresAt: '2099-01-01',
      revoked: false,
    },
    rights: {
      documentId: `license-${n}`,
      commercialUse: true,
      expiresAt: '2099-01-01',
      revoked: false,
    },
    approval: {
      id: `approval-${n}`,
      reviewerId: actor,
      binding: b,
      expiresAt: '2099-01-01',
      revoked: false,
    },
    exactIdentityEvidenceId: 'fixture://identity',
    authenticPhotographEvidenceId: 'fixture://photograph',
    contradictions: [],
    role: 'FRONT',
  };
}
function approve(n, change = () => {}) {
  const e = evidence(n);
  change(e);
  const imageId = uuid(200 + n);
  sql(
    `insert into lihen_private.external_image_rights values('license-${n}','fixture://rights','${'d'.repeat(64)}','${product}','${e.binding.sourceSha256}',true,'2099-01-01',false);`,
  );
  const result = sql(
    `select public.approve_external_image_authorization(${quote(JSON.stringify(e))}::jsonb,'${imageId}')`,
  );
  return { e, imageId, result };
}
const final = (n) =>
  `select public.finalize_external_product_webp('${uuid(100 + n)}','op-${n}','${actor}','r1','${(1000 + n).toString(16).padStart(64, '0')}',100,600,600)`;
function object(n) {
  const sha = (1000 + n).toString(16).padStart(64, '0');
  sql(
    `insert into storage.objects values('lihen-product-web','products/${product}/${uuid(200 + n)}/web/${sha}.webp','{"mimetype":"image/webp","size":100}');`,
  );
}
let assertions = 0;
const check = (condition, message) => {
  assert(condition, message);
  assertions++;
};
function rejects(q, reason) {
  try {
    sql(q);
    throw new Error('Expected SQL refusal');
  } catch (e) {
    check(String(e.stderr ?? e).includes(reason), String(e.stderr ?? e));
  }
}
check(
  sql(
    `select has_function_privilege('authenticated','public.finalize_external_product_webp(uuid,text,uuid,text,text,bigint,integer,integer)','EXECUTE')`,
  ) === 'f',
  'browser cannot finalize',
);
check(
  sql(
    `select has_function_privilege('anon','public.approve_external_image_authorization(jsonb,uuid)','EXECUTE')`,
  ) === 'f',
  'anon cannot approve',
);
approve(1);
sql(`insert into product_images(id,product_id,public_url,is_main,sort_order,source_type,status)
values('${uuid(999)}','${product}','fixture://prior-image',true,0,'STORAGE','ACTIVE')`);
object(1);
const first = JSON.parse(sql(final(1)));
check(first.replayed === false, 'positive registration');
check(JSON.parse(sql(final(1))).replayed === true, 'same operation replays');
check(
  sql(`select source_type from product_images where id='${uuid(201)}'`) === 'VERIFIED_EXTERNAL',
  'provenance not MANUAL',
);
rejects(final(1).replace("'r1'", "'changed'"), 'DERIVATIVE_INVALID');
approve(10, (e) => {
  e.binding.sourceSha256 = evidence(1).binding.sourceSha256;
});
object(10);
rejects(final(10), 'DUPLICATE');
approve(2);
object(2);
sql(`select public.revoke_external_image_authorization('${uuid(102)}')`);
rejects(final(2), 'AUTHORIZATION_INVALID');
approve(3);
object(3);
sql(`update lihen_private.external_image_rights set revoked=true where document_id='license-3'`);
rejects(final(3), 'AUTHORIZATION_INVALID');
sql(
  `update lihen_private.external_image_rights set revoked=false,expires_at='2000-01-01' where document_id='license-3'`,
);
rejects(final(3), 'AUTHORIZATION_INVALID');
approve(4);
object(4);
sql(`update products set updated_at=updated_at+interval '1 second' where id='${product}'`);
rejects(final(4), 'AUTHORIZATION_INVALID');
sql(`update products set updated_at=${quote(version)} where id='${product}'`);
sql(
  `insert into product_variants values('${uuid(500)}','${product}','local-variant','local-10ml','local-tone')`,
);
rejects(final(4), 'AUTHORIZATION_INVALID');
sql(`update lihen_private.external_image_authorities set revoked=true`);
rejects(final(4), 'AUTHORIZATION_INVALID');
sql(`update lihen_private.external_image_authorities set revoked=false`);
rejects(
  `select public.read_external_image_authorization('${uuid(104)}','different-operation','${actor}')`,
  'OPERATION_CONFLICT',
);
// Two simultaneous finalizers for one operation: exactly one insert and one replay.
approve(5);
object(5);
const asyncExec = promisify(execFile);
const pair = await Promise.all(
  [1, 2].map(() => asyncExec(bin, [...args, '-d', db, '-c', final(5)], { encoding: 'utf8' })),
);
check(
  pair.map((p) => JSON.parse(p.stdout.trim()).replayed).filter(Boolean).length === 1,
  'concurrent replay',
);
check(
  sql(`select count(*) from product_images where id='${uuid(205)}'`) === '1',
  'single concurrent record',
);
// Fill to four, then race for the fifth slot. Product row lock enforces the cap.
for (const n of [6, 7]) {
  approve(n);
  object(n);
  sql(final(n));
}
for (const n of [8, 9]) {
  approve(n);
  object(n);
}
const race = await Promise.allSettled(
  [8, 9].map((n) => asyncExec(bin, [...args, '-d', db, '-c', final(n)], { encoding: 'utf8' })),
);
check(race.filter((r) => r.status === 'fulfilled').length === 1, 'only one fifth slot');
check(
  sql(
    `select count(*) from product_images where product_id='${product}' and source_type='VERIFIED_EXTERNAL'`,
  ) === '5',
  'five image limit',
);
check(
  sql(
    `select count(*) from product_images where id='${uuid(999)}' and is_main and public_url='fixture://prior-image'`,
  ) === '1',
  'no prior primary image replaced',
);
const report = {
  status: 'PASS',
  assertions,
  database: db,
  host: '127.0.0.1',
  port: 56439,
  syntheticOnly: true,
  remoteConnections: 0,
};
writeFileSync('../external-image-postgres-results.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
