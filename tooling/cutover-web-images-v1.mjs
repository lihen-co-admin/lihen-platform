#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const manifestPath = resolve(root, 'data/catalog-v1/web-image-storage-upload-dry-run-v1.json');
const derivativeRoot = resolve(root, 'data/catalog-v1');
const expectedCount = 952;
const bucket = 'lihen-product-web';
const maxBytes = 3 * 1024 * 1024;
const execute = process.argv.includes('--execute');
const reportArg = process.argv.find((arg) => arg.startsWith('--report='));
const reportPath = reportArg
  ? resolve(process.cwd(), reportArg.slice('--report='.length))
  : resolve(root, `data/catalog-v1/web-image-storage-cutover-${execute ? 'execute' : 'dry-run'}-report-v1.json`);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value.replace(/\/$/, '');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function publicUrl(baseUrl, objectPath) {
  return `${baseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
}

async function loadAndValidateManifest() {
  const rows = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert(Array.isArray(rows), 'Upload manifest must be an array.');
  assert(rows.length === expectedCount, `Expected ${expectedCount} manifest rows, got ${rows.length}.`);

  const imageIds = new Set();
  const productIds = new Set();
  const paths = new Set();
  const localPaths = new Set();
  let totalBytes = 0;

  for (const row of rows) {
    assert(row.bucket === bucket, `Unexpected bucket for ${row.product_image_id}.`);
    assert(row.mime_type === 'image/webp', `Unexpected MIME for ${row.product_image_id}.`);
    assert(Number.isInteger(row.derivative_size_bytes) && row.derivative_size_bytes > 0 && row.derivative_size_bytes <= maxBytes,
      `Invalid byte size for ${row.product_image_id}.`);
    assert(Number.isInteger(row.width) && row.width > 0 && Number.isInteger(row.height) && row.height > 0,
      `Invalid dimensions for ${row.product_image_id}.`);
    assert(/^[0-9a-f]{64}$/.test(row.derivative_sha256), `Invalid sha256 for ${row.product_image_id}.`);
    const expectedPath = `products/${row.product_id}/${row.product_image_id}/web/${row.derivative_sha256}.webp`;
    assert(row.storage_path === expectedPath, `Non-deterministic storage path for ${row.product_image_id}.`);
    assert(!imageIds.has(row.product_image_id), `Duplicate product_image_id ${row.product_image_id}.`);
    assert(!productIds.has(row.product_id), `Expected one Web card per product; duplicate product_id ${row.product_id}.`);
    assert(!paths.has(row.storage_path), `Duplicate storage_path ${row.storage_path}.`);
    assert(!localPaths.has(row.local_path), `Duplicate local_path ${row.local_path}.`);
    imageIds.add(row.product_image_id);
    productIds.add(row.product_id);
    paths.add(row.storage_path);
    localPaths.add(row.local_path);

    const localFile = resolve(derivativeRoot, row.local_path);
    assert(existsSync(localFile), `Missing derivative file: ${row.local_path}`);
    const bytes = await readFile(localFile);
    assert(bytes.length === row.derivative_size_bytes, `Size mismatch: ${row.local_path}`);
    assert(sha256(bytes) === row.derivative_sha256, `Hash mismatch: ${row.local_path}`);
    totalBytes += bytes.length;
  }

  return { rows, totalBytes };
}

async function fetchWithAuth(url, key, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  return fetch(url, { ...init, headers });
}

async function verifyPublicObject(baseUrl, row) {
  const url = publicUrl(baseUrl, row.storage_path);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return { ok: false, status: response.status, reason: `GET ${response.status}` };
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== row.derivative_size_bytes) {
    return { ok: false, status: response.status, reason: `size ${bytes.length} != ${row.derivative_size_bytes}` };
  }
  const actualHash = sha256(bytes);
  if (actualHash !== row.derivative_sha256) {
    return { ok: false, status: response.status, reason: `sha256 ${actualHash} != ${row.derivative_sha256}` };
  }
  return { ok: true, status: response.status };
}

async function uploadObject(baseUrl, key, row, bytes) {
  const encodedPath = row.storage_path.split('/').map(encodeURIComponent).join('/');
  const endpoint = `${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`;
  const response = await fetchWithAuth(endpoint, key, {
    method: 'POST',
    headers: {
      'Content-Type': row.mime_type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'x-upsert': 'false',
    },
    body: bytes,
  });

  if (response.ok) return { uploaded: true, existed: false };

  // Idempotent replay: an existing object is accepted only if public bytes match the manifest hash exactly.
  if (response.status === 400 || response.status === 409) {
    const existing = await verifyPublicObject(baseUrl, row);
    if (existing.ok) return { uploaded: false, existed: true };
  }

  const body = await response.text();
  throw new Error(`Storage upload failed ${response.status}: ${body.slice(0, 500)}`);
}

async function finalizeMetadata(baseUrl, key, row) {
  const endpoint = `${baseUrl}/rest/v1/rpc/finalize_web_image_storage_cutover`;
  const response = await fetchWithAuth(endpoint, key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_operation_key: `phase1.22.2:web-card:${row.product_image_id}:${row.derivative_sha256}`,
      p_product_image_id: row.product_image_id,
      p_product_id: row.product_id,
      p_source_reference_id: row.source_reference_id,
      p_bucket_id: row.bucket,
      p_object_path: row.storage_path,
      p_public_url: publicUrl(baseUrl, row.storage_path),
      p_mime_type: row.mime_type,
      p_byte_size: row.derivative_size_bytes,
      p_sha256: row.derivative_sha256,
      p_width_px: row.width,
      p_height_px: row.height,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Metadata finalizer failed ${response.status}: ${text.slice(0, 800)}`);
  const data = text ? JSON.parse(text) : [];
  assert(Array.isArray(data) && data.length === 1, 'Unexpected metadata finalizer response.');
  return data[0];
}

async function processRow(baseUrl, key, row) {
  const file = resolve(derivativeRoot, row.local_path);
  const bytes = await readFile(file);
  const upload = await uploadObject(baseUrl, key, row, bytes);
  const verified = await verifyPublicObject(baseUrl, row);
  if (!verified.ok) throw new Error(`Post-upload object verification failed: ${verified.reason}`);
  const metadata = await finalizeMetadata(baseUrl, key, row);
  return {
    product_id: row.product_id,
    product_image_id: row.product_image_id,
    storage_path: row.storage_path,
    sha256: row.derivative_sha256,
    uploaded: upload.uploaded,
    object_replayed: upload.existed,
    metadata_replayed: Boolean(metadata.replayed),
    storage_asset_id: metadata.storage_asset_id,
    source_id: metadata.source_id,
  };
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function lane() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = { ok: true, value: await worker(items[index], index) };
      } catch (error) {
        results[index] = { ok: false, error: error instanceof Error ? error.message : String(error), item: items[index] };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => lane()));
  return results;
}

async function countCanonicalWebCards(baseUrl, key) {
  const endpoint = `${baseUrl}/rest/v1/product_images?select=id&source_type=eq.CATALOG_EVIDENCE_CROP&asset_role=eq.DERIVATIVE&derivative_profile=eq.WEB_CARD&status=eq.ACTIVE`;
  const response = await fetchWithAuth(endpoint, key, {
    method: 'HEAD',
    headers: { Prefer: 'count=exact', Range: '0-0' },
  });
  if (!response.ok) throw new Error(`Count verification failed ${response.status}: ${await response.text()}`);
  const range = response.headers.get('content-range');
  const total = range?.split('/')[1];
  return total && total !== '*' ? Number(total) : null;
}

async function main() {
  const startedAt = new Date().toISOString();
  const { rows, totalBytes } = await loadAndValidateManifest();

  const baseReport = {
    phase: '1.22.2',
    mode: execute ? 'EXECUTE' : 'DRY_RUN',
    started_at: startedAt,
    manifest_path: 'data/catalog-v1/web-image-storage-upload-dry-run-v1.json',
    expected_count: expectedCount,
    validated_count: rows.length,
    validated_total_bytes: totalBytes,
    bucket,
    uploads_executed: false,
    metadata_finalization_executed: false,
  };

  if (!execute) {
    const report = { ...baseReport, status: 'DRY_RUN_PASS', completed_at: new Date().toISOString() };
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const baseUrl = requiredEnv('SUPABASE_URL');
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  assert(baseUrl.startsWith('https://'), 'SUPABASE_URL must use https://');

  const results = await runPool(rows, 8, (row) => processRow(baseUrl, key, row));
  const failures = results.filter((r) => !r.ok);
  const successes = results.filter((r) => r.ok).map((r) => r.value);
  const canonicalWebCardCount = failures.length === 0 ? await countCanonicalWebCards(baseUrl, key) : null;

  const report = {
    ...baseReport,
    uploads_executed: true,
    metadata_finalization_executed: true,
    status: failures.length === 0 && canonicalWebCardCount === expectedCount ? 'EXECUTE_PASS' : 'EXECUTE_INCOMPLETE',
    successful_count: successes.length,
    failed_count: failures.length,
    uploaded_new_count: successes.filter((r) => r.uploaded).length,
    object_replay_count: successes.filter((r) => r.object_replayed).length,
    metadata_replay_count: successes.filter((r) => r.metadata_replayed).length,
    canonical_web_card_metadata_count: canonicalWebCardCount,
    failures: failures.map((r) => ({
      product_id: r.item?.product_id,
      product_image_id: r.item?.product_image_id,
      storage_path: r.item?.storage_path,
      error: r.error,
    })),
    completed_at: new Date().toISOString(),
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'EXECUTE_PASS') process.exitCode = 1;
}

main().catch(async (error) => {
  const report = {
    phase: '1.22.2',
    mode: execute ? 'EXECUTE' : 'DRY_RUN',
    status: 'FAILED',
    error: error instanceof Error ? error.message : String(error),
    completed_at: new Date().toISOString(),
  };
  try { await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); } catch { /* Best-effort failure report only. */ }
  console.error(report.error);
  process.exitCode = 1;
});
