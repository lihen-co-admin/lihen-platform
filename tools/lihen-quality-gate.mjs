/* global console */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const REPORT_DIR = path.join(os.tmpdir(), 'lihen-platform-quality-gate');
const VITEST_JSON = path.join(REPORT_DIR, 'vitest-results.json');
const REPORT_JSON = path.join(REPORT_DIR, 'LIHEN_QUALITY_GATE_LATEST.json');
const REPORT_MD = path.join(REPORT_DIR, 'LIHEN_QUALITY_GATE_LATEST.md');

const DOMAIN_ORDER = [
  'PRODUCT MASTER',
  'INVENTORY',
  'SUPPLIERS',
  'PROCUREMENT',
  'ORDERS',
  'SALES',
  'FINANCE',
  'CATALOG',
  'PUBLISHING',
  'GOVERNANCE',
  'DEV ACTIVATION',
  'INTELLIGENCE',
  'STOREFRONT',
  'PUBLIC HUB',
  'CONTROL CENTER',
  'PLATFORM FOUNDATION',
  'ARCHITECTURE',
];

function normalize(value) {
  return String(value ?? '').replaceAll('\\', '/').toLowerCase();
}

function hasPathSegment(p, segment) {
  const clean = segment.replace(/^\/+|\/+$/g, '');
  return p === clean || p.startsWith(`${clean}/`) || p.includes(`/${clean}/`);
}

export function classifyTestFile(fileName) {
  const p = normalize(fileName);
  const base = p.split('/').pop() ?? p;

  if (hasPathSegment(p, 'tests/architecture')) return 'ARCHITECTURE';
  if (hasPathSegment(p, 'apps/storefront')) return 'STOREFRONT';
  if (hasPathSegment(p, 'packages/intelligence-core')) return 'INTELLIGENCE';
  if (hasPathSegment(p, 'packages/products')) return 'PRODUCT MASTER';
  if (hasPathSegment(p, 'packages/inventory')) return 'INVENTORY';
  if (hasPathSegment(p, 'packages/suppliers')) return 'SUPPLIERS';
  if (hasPathSegment(p, 'packages/procurement')) return 'PROCUREMENT';
  if (hasPathSegment(p, 'packages/orders')) return 'ORDERS';
  if (hasPathSegment(p, 'packages/sales')) return 'SALES';
  if (hasPathSegment(p, 'packages/finance')) return 'FINANCE';
  if (hasPathSegment(p, 'packages/catalog')) return 'CATALOG';
  if (hasPathSegment(p, 'packages/public-hub')) return 'PUBLIC HUB';

  if (hasPathSegment(p, 'apps/control-center')) {
    if (base.includes('supplier-pilot')) return 'SUPPLIERS';
    if (
      base.includes('dev-activation') ||
      base.includes('dev-pilot') ||
      base.includes('operational-activation')
    ) return 'DEV ACTIVATION';
    if (base.includes('publishing')) return 'PUBLISHING';
    if (base.includes('governance') || base.includes('operation-console')) return 'GOVERNANCE';
    if (base.includes('intelligence') || base.includes('dashboard')) return 'INTELLIGENCE';
    if (base.includes('supply-inventory')) return 'INVENTORY';
    if (base.includes('order-') || base.includes('commerce')) return 'ORDERS';
    return 'CONTROL CENTER';
  }

  if (
    hasPathSegment(p, 'packages/core') ||
    hasPathSegment(p, 'packages/shared') ||
    hasPathSegment(p, 'packages/identity') ||
    hasPathSegment(p, 'packages/database')
  ) return 'PLATFORM FOUNDATION';

  return 'PLATFORM FOUNDATION';
}

function quoteForShell(value) {
  if (process.platform === 'win32') return `"${String(value).replaceAll('"', '""')}"`;
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function runShell(command) {
  if (process.platform === 'win32') {
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  }
  return spawnSync('/bin/sh', ['-lc', command], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function printFailure(label, result) {
  console.error(`\n${label}: FAIL`);
  if (result.stdout?.trim()) console.error(result.stdout.trim());
  if (result.stderr?.trim()) console.error(result.stderr.trim());
}

function gate(label, command) {
  process.stdout.write(`${label.padEnd(18)} `);
  const result = runShell(command);
  const passed = result.status === 0;
  console.log(passed ? 'PASS' : 'FAIL');
  if (!passed) printFailure(label, result);
  return passed;
}

function assertionStatus(assertion) {
  return String(assertion?.status ?? '').toLowerCase();
}

function isPassed(assertion) {
  return assertionStatus(assertion) === 'passed';
}

function readVitestReport() {
  if (!existsSync(VITEST_JSON)) {
    throw new Error(`Vitest JSON report not found at ${VITEST_JSON}`);
  }
  return JSON.parse(readFileSync(VITEST_JSON, 'utf8'));
}

function buildTraceability(vitest) {
  const rows = [];
  for (const file of vitest.testResults ?? []) {
    const fileName = String(file.name ?? file.testFilePath ?? 'unknown');
    const domain = classifyTestFile(fileName);
    const assertions = Array.isArray(file.assertionResults) ? file.assertionResults : [];

    for (const assertion of assertions) {
      const ancestor = Array.isArray(assertion.ancestorTitles) ? assertion.ancestorTitles : [];
      const title = [...ancestor, assertion.title].filter(Boolean).join(' > ');
      rows.push({
        domain,
        file: normalize(fileName).replace(normalize(ROOT) + '/', ''),
        title,
        status: assertionStatus(assertion) || 'unknown',
      });
    }
  }
  return rows;
}

function summarizeByDomain(traceability) {
  const map = new Map();
  for (const row of traceability) {
    const current = map.get(row.domain) ?? { total: 0, passed: 0, failed: 0, skipped: 0 };
    current.total += 1;
    if (row.status === 'passed') current.passed += 1;
    else if (row.status === 'failed') current.failed += 1;
    else current.skipped += 1;
    map.set(row.domain, current);
  }

  return DOMAIN_ORDER
    .filter((domain) => map.has(domain))
    .map((domain) => ({ domain, ...map.get(domain) }));
}

function numberFrom(vitest, key, fallback) {
  const value = Number(vitest?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function renderConsole(summary) {
  console.log('\nLIHEN PLATFORM QUALITY GATE');
  console.log('===========================');
  for (const row of summary.domains) {
    const ratio = `${row.passed}/${row.total} PASS`;
    console.log(`${row.domain.padEnd(22)} ${ratio}`);
  }
  console.log('---------------------------');
  console.log(`Test Files:     ${summary.testFilesPassed}/${summary.testFilesTotal} PASS`);
  console.log(`Tests:          ${summary.testsPassed}/${summary.testsTotal} PASS`);
  console.log(`Architecture:   ${summary.architecturePassed}/${summary.architectureTotal} PASS`);
  console.log(`Traceability:   ${summary.traceabilityCount}/${summary.testsTotal} IDENTIFIED`);
  console.log(`Typecheck:      ${summary.gates.typecheck ? 'PASS' : 'FAIL'}`);
  console.log(`Lint:           ${summary.gates.lint ? 'PASS' : 'FAIL'}`);
  console.log(`Build:          ${summary.gates.build ? 'PASS' : 'FAIL'}`);
  console.log('');
  console.log(`FINAL RESULT:   ${summary.finalResult}`);
  console.log(`Full report:    ${REPORT_MD}`);
}

function renderMarkdown(summary, traceability) {
  const lines = [
    '# LIHEN PLATFORM QUALITY GATE',
    '',
    `- Test Files: **${summary.testFilesPassed}/${summary.testFilesTotal} PASS**`,
    `- Tests: **${summary.testsPassed}/${summary.testsTotal} PASS**`,
    `- Architecture: **${summary.architecturePassed}/${summary.architectureTotal} PASS**`,
    `- Traceability: **${summary.traceabilityCount}/${summary.testsTotal} IDENTIFIED**`,
    `- Typecheck: **${summary.gates.typecheck ? 'PASS' : 'FAIL'}**`,
    `- Lint: **${summary.gates.lint ? 'PASS' : 'FAIL'}**`,
    `- Build: **${summary.gates.build ? 'PASS' : 'FAIL'}**`,
    `- FINAL RESULT: **${summary.finalResult}**`,
    '',
    '## Domain matrix',
    '',
    '| Domain | Passed | Total | Result |',
    '| --- | ---: | ---: | --- |',
  ];

  for (const row of summary.domains) {
    lines.push(`| ${row.domain} | ${row.passed} | ${row.total} | ${row.passed === row.total ? 'PASS' : 'FAIL'} |`);
  }

  lines.push('', '## Complete test traceability', '');
  for (const row of traceability) {
    lines.push(`- [${row.status.toUpperCase()}] **${row.domain}** — \`${row.file}\` — ${row.title}`);
  }

  return lines.join('\n') + '\n';
}

function selfTest() {
  const cases = [
    ['packages/products/tests/create-product.test.ts', 'PRODUCT MASTER'],
    ['C:/repo/packages/products/tests/create-product.test.ts', 'PRODUCT MASTER'],
    ['packages/inventory/tests/inventory.test.ts', 'INVENTORY'],
    ['packages/suppliers/tests/supplier.test.ts', 'SUPPLIERS'],
    ['packages/procurement/tests/procurement.test.ts', 'PROCUREMENT'],
    ['packages/orders/tests/order-draft.test.ts', 'ORDERS'],
    ['packages/sales/tests/sales.test.ts', 'SALES'],
    ['packages/finance/tests/finance.test.ts', 'FINANCE'],
    ['packages/catalog/tests/catalog.test.ts', 'CATALOG'],
    ['apps/control-center/tests/publishing-readiness.test.ts', 'PUBLISHING'],
    ['apps/control-center/tests/governance-readiness.test.ts', 'GOVERNANCE'],
    ['apps/control-center/tests/dev-activation-preflight.test.ts', 'DEV ACTIVATION'],
    ['apps/control-center/tests/dashboard-intelligence.test.ts', 'INTELLIGENCE'],
    ['apps/storefront/tests/public-experience-state.test.ts', 'STOREFRONT'],
    ['packages/public-hub/tests/public-hub-block.test.ts', 'PUBLIC HUB'],
    ['apps/control-center/tests/admin-experience-state.test.ts', 'CONTROL CENTER'],
    ['packages/core/tests/clock.test.ts', 'PLATFORM FOUNDATION'],
    ['tests/architecture/boundaries.test.ts', 'ARCHITECTURE'],
  ];

  for (const [input, expected] of cases) {
    const actual = classifyTestFile(input);
    if (actual !== expected) {
      console.error(`SELF TEST FAIL: ${input} => ${actual}, expected ${expected}`);
      process.exit(1);
    }
  }

  const baseGate = {
    typecheck: true,
    lint: true,
    testsCommandPassed: true,
    build: true,
    testFilesPassed: 10,
    testFilesTotal: 10,
    testsPassed: 100,
    testsTotal: 100,
    allTestsIdentified: true,
    architecturePassed: 40,
    architectureTotal: 40,
  };

  const finalGateCases = [
    [baseGate, true, 'architecture evidence present and passing'],
    [{ ...baseGate, architecturePassed: 0, architectureTotal: 0 }, false, 'architecture evidence missing'],
    [{ ...baseGate, architecturePassed: 39, architectureTotal: 40 }, false, 'architecture evidence failing'],
  ];

  for (const [input, expected, label] of finalGateCases) {
    const actual = evaluateFinalPass(input);
    if (actual !== expected) {
      console.error(`SELF TEST FAIL: ${label} => ${actual}, expected ${expected}`);
      process.exit(1);
    }
  }

  const total = cases.length + finalGateCases.length;
  console.log(`LIHEN quality gate self-test: ${total}/${total} PASS`);
}

if (process.argv.includes('--self-test')) {
  selfTest();
  process.exit(0);
}

mkdirSync(REPORT_DIR, { recursive: true });
rmSync(VITEST_JSON, { force: true });

console.log('LIHEN consolidated validation');
console.log('-----------------------------');

const typecheck = gate('Typecheck', 'pnpm typecheck');
const lint = gate('Lint', 'pnpm lint');

process.stdout.write(`${'Tests'.padEnd(18)} `);
const testResult = runShell(
  `pnpm exec vitest run --reporter=json --outputFile=${quoteForShell(VITEST_JSON)}`
);
const testsCommandPassed = testResult.status === 0;
console.log(testsCommandPassed ? 'PASS' : 'FAIL');
if (!testsCommandPassed && !existsSync(VITEST_JSON)) printFailure('Tests', testResult);

const build = gate('Build', 'pnpm build');

let vitest;
try {
  vitest = readVitestReport();
} catch (error) {
  console.error(`Unable to read Vitest report: ${error.message}`);
  process.exit(1);
}

const traceability = buildTraceability(vitest);
const domains = summarizeByDomain(traceability);
const architecture = domains.find((row) => row.domain === 'ARCHITECTURE') ?? {
  total: 0,
  passed: 0,
};

const testsTotal = numberFrom(vitest, 'numTotalTests', traceability.length);
const testsPassed = numberFrom(
  vitest,
  'numPassedTests',
  traceability.filter((row) => row.status === 'passed').length,
);
const testResults = Array.isArray(vitest.testResults) ? vitest.testResults : [];
const testFilesTotal = testResults.length;
const testFilesPassed = testResults.filter((file) => {
  const assertions = Array.isArray(file.assertionResults) ? file.assertionResults : [];
  return assertions.length > 0 && assertions.every(isPassed);
}).length;

const allTestsIdentified = traceability.length === testsTotal;

export function evaluateFinalPass({
  typecheck,
  lint,
  testsCommandPassed,
  build,
  testFilesPassed,
  testFilesTotal,
  testsPassed,
  testsTotal,
  allTestsIdentified,
  architecturePassed,
  architectureTotal,
}) {
  return (
    typecheck &&
    lint &&
    testsCommandPassed &&
    build &&
    testFilesPassed === testFilesTotal &&
    testsPassed === testsTotal &&
    allTestsIdentified &&
    architectureTotal > 0 &&
    architecturePassed === architectureTotal
  );
}

const finalPass = evaluateFinalPass({
  typecheck,
  lint,
  testsCommandPassed,
  build,
  testFilesPassed,
  testFilesTotal,
  testsPassed,
  testsTotal,
  allTestsIdentified,
  architecturePassed: architecture.passed,
  architectureTotal: architecture.total,
});

const summary = {
  gates: { typecheck, lint, tests: testsCommandPassed, build },
  testFilesTotal,
  testFilesPassed,
  testsTotal,
  testsPassed,
  architectureTotal: architecture.total,
  architecturePassed: architecture.passed,
  traceabilityCount: traceability.length,
  domains,
  finalResult: finalPass ? 'PASS' : 'FAIL',
};

writeFileSync(REPORT_JSON, JSON.stringify({ summary, traceability }, null, 2) + '\n', 'utf8');
writeFileSync(REPORT_MD, renderMarkdown(summary, traceability), 'utf8');
renderConsole(summary);

process.exit(finalPass ? 0 : 1);
