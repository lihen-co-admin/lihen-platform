import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

interface LegacyBoundaryBaseline {
  readonly domainToComposition: readonly string[];
}

function filesUnder(dir: string): string[] {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];

  const results: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) {
      results.push(...filesUnder(relative(root, path)));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      results.push(path);
    }
  }
  return results;
}

function expectNoImport(dir: string, forbidden: RegExp): void {
  for (const file of filesUnder(dir)) {
    const source = readFileSync(file, 'utf8');
    expect(
      source,
      `${relative(root, file)} violates Control Center layer boundary`,
    ).not.toMatch(forbidden);
  }
}

function normalizedRelative(path: string): string {
  return relative(root, path).replaceAll('\\', '/');
}

function findViolatingFiles(dir: string, forbidden: RegExp): readonly string[] {
  return filesUnder(dir)
    .filter((file) => forbidden.test(readFileSync(file, 'utf8')))
    .map(normalizedRelative)
    .sort();
}

function readLegacyBaseline(): LegacyBoundaryBaseline {
  const path = join(root, 'tests/architecture/control-center-legacy-boundaries.json');
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<LegacyBoundaryBaseline>;

  return {
    domainToComposition: Array.isArray(parsed.domainToComposition)
      ? parsed.domainToComposition.map(String).sort()
      : [],
  };
}

const presentationImport =
  /from\s+['"][^'"]*(?:\/pages\/|\/components\/|\/styles\/|\.\.\/pages|\.\.\/components|\.\.\/styles)/;

const compositionImport =
  /from\s+['"][^'"]*(?:\/composition\/|\.\.\/composition)/;

const directPersistenceImport =
  /from\s+['"](?:@supabase\/|@lihen\/database)|getBrowserSupabaseClient|Supabase[A-Z]\w*Repository/;

describe('Control Center architecture foundation — GAP-001 / GAP-002', () => {
  it('Control Center domain semantics do not depend on Presentation', () => {
    expectNoImport('apps/control-center/src/domain', presentationImport);
  });

  it('Control Center domain → Composition debt never grows beyond the captured legacy baseline', () => {
    const baseline = readLegacyBaseline();
    const current = findViolatingFiles('apps/control-center/src/domain', compositionImport);

    expect(
      current,
      [
        'apps/control-center/src/domain contains legacy Domain → Composition dependencies.',
        'WAVE 1 permits only the exact captured baseline while those responsibilities are',
        'extracted incrementally by later GAPs. New files/imports must not be added.',
      ].join(' '),
    ).toEqual(baseline.domainToComposition);
  });

  it('Control Center domain semantics do not access persistence adapters directly', () => {
    expectNoImport('apps/control-center/src/domain', directPersistenceImport);
  });

  it('Composition stays independent from Presentation', () => {
    expectNoImport('apps/control-center/src/composition', presentationImport);
  });

  it('future Intelligence layer stays independent from Presentation', () => {
    expectNoImport('apps/control-center/src/intelligence', presentationImport);
  });

  it('future Policy layer stays independent from Presentation', () => {
    expectNoImport('apps/control-center/src/policy', presentationImport);
  });

  it('future Governance layer stays independent from Presentation', () => {
    expectNoImport('apps/control-center/src/governance', presentationImport);
  });
});
