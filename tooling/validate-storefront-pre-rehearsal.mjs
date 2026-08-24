import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(process.cwd());

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

function runNode(script) {
  execFileSync(process.execPath, [resolve(repoRoot, script)], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });
}

const environment = requiredEnv('LIHEN_RELEASE_ENVIRONMENT').toUpperCase();
if (!['DEV', 'STAGING'].includes(environment)) {
  fail('FASE 6 pre-rehearsal may only run against DEV or STAGING. PRODUCTION is reserved for FASE 7.');
}

const status = capture('git', ['status', '--porcelain']);
const unexpected = status
  ? status
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => !line.slice(3).replaceAll('\\', '/').endsWith('.tsbuildinfo'))
  : [];

if (unexpected.length > 0) {
  fail(`Pre-rehearsal requires no unexpected Git changes:\n${unexpected.join('\n')}`);
}

const requiredFiles = [
  'docs/PHASE6_1_STOREFRONT_RELEASE_ENVIRONMENT_CONTRACT.md',
  'docs/PHASE6_2_STOREFRONT_RELEASE_ARTIFACT_INTEGRITY.md',
  'docs/PHASE6_3_STOREFRONT_RELEASE_CANDIDATE_MANIFEST.md',
  'docs/PHASE6_4_RELEASE_TOOLING_HARDENING.md',
  'docs/PHASE6_5_RELEASE_CANDIDATE_INDEPENDENT_VERIFICATION.md',
  'docs/PHASE6_6_PRE_REHEARSAL_HANDOFF.md',
  'tooling/validate-storefront-release-env.mjs',
  'tooling/validate-storefront-dist.mjs',
  'tooling/prepare-storefront-release-candidate.mjs',
  'tooling/validate-storefront-release-candidate.mjs',
];

for (const path of requiredFiles) {
  if (!existsSync(resolve(repoRoot, path))) fail(`Missing pre-rehearsal contract file: ${path}`);
}

runNode('tooling/validate-storefront-release-candidate.mjs');

console.log('Storefront pre-rehearsal readiness: PASS');
console.log(`Environment: ${environment}`);
console.log('Production deployment remains blocked for FASE 7.');
