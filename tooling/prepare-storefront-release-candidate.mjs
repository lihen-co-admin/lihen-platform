import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const repoRoot = resolve(process.cwd());
const distRoot = resolve(repoRoot, 'apps/storefront/dist');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`Missing required release-candidate environment variable: ${name}`);
  }
  return value;
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function capture(command, args) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }).trim();
}

function listFiles(root, current = root) {
  const entries = readdirSync(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = resolve(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(root, absolute));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return files.sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function distInventory() {
  if (!statSync(distRoot, { throwIfNoEntry: false })?.isDirectory()) {
    fail('Storefront dist does not exist after the release build.');
  }

  const files = listFiles(distRoot).map((absolute) => {
    const bytes = readFileSync(absolute);
    return {
      path: relative(distRoot, absolute).split(sep).join('/'),
      sizeBytes: bytes.length,
      sha256: sha256(bytes),
    };
  });

  if (files.length === 0) {
    fail('Storefront dist is empty.');
  }

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

function assertInitialGitClean() {
  const status = capture('git', ['status', '--porcelain']);
  if (status) {
    fail(
      'Release Candidate generation requires a clean Git worktree before validation. ' +
        'Commit, restore, or remove local changes first.',
    );
  }
}

function generatedBuildMetadataChanges() {
  const lines = capture('git', ['status', '--porcelain'])
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const unexpected = lines.filter((line) => {
    const path = line.slice(3).replaceAll('\\', '/');
    return !path.endsWith('.tsbuildinfo');
  });

  if (unexpected.length > 0) {
    fail(
      `Release validation changed unexpected tracked/untracked files:\n${unexpected.join('\n')}`,
    );
  }

  return lines.map((line) => line.slice(3).replaceAll('\\', '/'));
}

function extractSupabaseProjectRef(url) {
  const match = /^https:\/\/([a-z0-9-]+)\.supabase\.co$/i.exec(url);
  if (!match) {
    fail('VITE_SUPABASE_URL does not match the approved Supabase URL contract.');
  }
  return match[1];
}

function resolveManifestPath(rawPath) {
  const output = isAbsolute(rawPath) ? resolve(rawPath) : resolve(repoRoot, rawPath);
  const rel = relative(repoRoot, output);

  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..')) {
    fail(
      'LIHEN_RELEASE_MANIFEST_PATH must point outside the repository so release evidence does not dirty Git.',
    );
  }
  return output;
}

assertInitialGitClean();

const releaseCandidate = requiredEnv('LIHEN_RELEASE_CANDIDATE');
const releaseEnvironment = requiredEnv('LIHEN_RELEASE_ENVIRONMENT').toUpperCase();
const manifestPath = resolveManifestPath(requiredEnv('LIHEN_RELEASE_MANIFEST_PATH'));
const phase5EvidenceCommit = requiredEnv('LIHEN_PHASE5_E2E_EVIDENCE_COMMIT');
const supabaseUrl = requiredEnv('VITE_SUPABASE_URL');
requiredEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

if (!['DEV', 'STAGING', 'PRODUCTION'].includes(releaseEnvironment)) {
  fail('LIHEN_RELEASE_ENVIRONMENT must be DEV, STAGING, or PRODUCTION.');
}

console.log(`Preparing Storefront Release Candidate ${releaseCandidate}`);
console.log(`Environment label: ${releaseEnvironment}`);
console.log('No deployment or database mutation is performed by this command.');

run('pnpm', ['check']);
run('pnpm', ['test:e2e:storefront']);
run('pnpm', ['build:storefront:release']);

const buildMetadataChanges = generatedBuildMetadataChanges();
const inventory = distInventory();
const commitSha = capture('git', ['rev-parse', 'HEAD']);
const commitShortSha = capture('git', ['rev-parse', '--short=12', 'HEAD']);
const branch = capture('git', ['branch', '--show-current']) || null;
const packageManager = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))
  .packageManager;

const manifest = {
  schemaVersion: 'LIHEN_STOREFRONT_RELEASE_CANDIDATE_MANIFEST_V1',
  releaseCandidate,
  generatedAt: new Date().toISOString(),
  source: {
    gitCommitSha: commitSha,
    gitCommitShortSha: commitShortSha,
    gitBranch: branch,
    worktreeCleanBeforeValidation: true,
    generatedBuildMetadataChanges: buildMetadataChanges,
  },
  target: {
    environment: releaseEnvironment,
    supabaseProjectRef: extractSupabaseProjectRef(supabaseUrl),
    publishableKeyPresent: true,
    credentialsPersistedInManifest: false,
  },
  provenance: {
    phase5GateVersion: 'PHASE5_STOREFRONT_E2E_EXIT_GATE_V1',
    phase5GateStatus: 'PASS',
    phase5E2eEvidenceCommit: phase5EvidenceCommit,
    phase5E2eSuiteVersion: 'PHASE5_STOREFRONT_E2E_V1',
  },
  validations: {
    fullRepositoryCheck: 'PASS',
    storefrontE2e: 'PASS',
    storefrontReleaseEnvironmentContract: 'PASS',
    storefrontReleaseBuild: 'PASS',
    storefrontDistIntegrity: 'PASS',
  },
  runtime: {
    node: process.version,
    packageManager,
    platform: process.platform,
    architecture: process.arch,
  },
  artifact: {
    root: 'apps/storefront/dist',
    ...inventory,
  },
  safety: {
    deploymentPerformed: false,
    databaseMutationPerformed: false,
    productionTouchedByGenerator: false,
    secretsStored: false,
  },
};

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log('\nStorefront Release Candidate manifest: PASS');
console.log(`Manifest: ${manifestPath}`);
console.log(`Commit: ${commitShortSha}`);
console.log(`Dist files: ${inventory.fileCount}`);
console.log(`Dist SHA-256: ${inventory.sha256}`);
console.log(
  buildMetadataChanges.length > 0
    ? `Generated TypeScript metadata changed during validation: ${buildMetadataChanges.join(', ')}`
    : 'Git worktree remained clean after validation.',
);
