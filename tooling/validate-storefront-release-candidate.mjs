import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const repoRoot = resolve(process.cwd());
const distRoot = resolve(repoRoot, 'apps/storefront/dist');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`Missing required environment variable: ${name}`);
  return value;
}

function capture(command, args) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
  }).trim();
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function listFiles(root, current = root) {
  const entries = readdirSync(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = resolve(current, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(root, absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files.sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
}

function distInventory() {
  if (!statSync(distRoot, { throwIfNoEntry: false })?.isDirectory()) {
    fail('Storefront dist is missing.');
  }

  const files = listFiles(distRoot).map((absolute) => {
    const bytes = readFileSync(absolute);
    return {
      path: relative(distRoot, absolute).split(sep).join('/'),
      sizeBytes: bytes.length,
      sha256: sha256(bytes),
    };
  });

  const aggregateInput = files
    .map((file) => `${file.path}\t${file.sizeBytes}\t${file.sha256}`)
    .join('\n');

  return {
    fileCount: files.length,
    totalSizeBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
    sha256: sha256(Buffer.from(aggregateInput, 'utf8')),
    files,
  };
}

function assertNoSensitiveMaterial(value) {
  const text = JSON.stringify(value);
  const forbidden = [
    /service[_-]?role/i,
    /sb_secret_/i,
    /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\./,
    /VITE_SUPABASE_PUBLISHABLE_KEY/i,
    /SUPABASE_SERVICE_ROLE/i,
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) fail(`Release Candidate manifest contains forbidden sensitive material: ${match}`);
}

const rawManifestPath = requiredEnv('LIHEN_RELEASE_MANIFEST_PATH');
const manifestPath = isAbsolute(rawManifestPath)
  ? resolve(rawManifestPath)
  : resolve(repoRoot, rawManifestPath);

const rel = relative(repoRoot, manifestPath);
if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..')) {
  fail('Release Candidate manifest must remain outside the repository.');
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assertNoSensitiveMaterial(manifest);

if (manifest.schemaVersion !== 'LIHEN_STOREFRONT_RELEASE_CANDIDATE_MANIFEST_V1') {
  fail('Unsupported Release Candidate manifest schema.');
}

for (const [name, status] of Object.entries(manifest.validations ?? {})) {
  if (status !== 'PASS') fail(`Manifest validation is not PASS: ${name}=${status}`);
}

if (manifest.safety?.deploymentPerformed !== false) fail('Manifest says deployment was performed.');
if (manifest.safety?.databaseMutationPerformed !== false) fail('Manifest says a database mutation was performed.');
if (manifest.safety?.productionTouchedByGenerator !== false) fail('Manifest says production was touched.');
if (manifest.safety?.secretsStored !== false) fail('Manifest says secrets were stored.');
if (manifest.target?.credentialsPersistedInManifest !== false) fail('Manifest credential persistence flag is unsafe.');

const head = capture('git', ['rev-parse', 'HEAD']);
if (manifest.source?.gitCommitSha !== head) {
  fail(`Manifest commit ${manifest.source?.gitCommitSha ?? 'missing'} does not match HEAD ${head}.`);
}

const inventory = distInventory();
if (inventory.fileCount !== manifest.artifact?.fileCount) {
  fail(`Dist file count mismatch: current=${inventory.fileCount}, manifest=${manifest.artifact?.fileCount}`);
}
if (inventory.totalSizeBytes !== manifest.artifact?.totalSizeBytes) {
  fail(`Dist total size mismatch: current=${inventory.totalSizeBytes}, manifest=${manifest.artifact?.totalSizeBytes}`);
}
if (inventory.sha256 !== manifest.artifact?.sha256) {
  fail(`Dist SHA-256 mismatch: current=${inventory.sha256}, manifest=${manifest.artifact?.sha256}`);
}

const manifestFiles = new Map((manifest.artifact?.files ?? []).map((file) => [file.path, file]));
for (const file of inventory.files) {
  const expected = manifestFiles.get(file.path);
  if (!expected) fail(`Dist file missing from manifest: ${file.path}`);
  if (expected.sizeBytes !== file.sizeBytes || expected.sha256 !== file.sha256) {
    fail(`Dist file integrity mismatch: ${file.path}`);
  }
}

console.log('Storefront Release Candidate independent verification: PASS');
console.log(`Manifest: ${manifestPath}`);
console.log(`Commit: ${head.slice(0, 12)}`);
console.log(`Dist files: ${inventory.fileCount}`);
console.log(`Dist SHA-256: ${inventory.sha256}`);
