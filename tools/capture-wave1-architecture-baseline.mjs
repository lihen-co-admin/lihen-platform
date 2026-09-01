import process from 'node:process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();

function filesUnder(dir) {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];

  const results = [];
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

const compositionImport =
  /from\s+['"][^'"]*(?:\/composition\/|\.\.\/composition)/;

const domainToComposition = filesUnder('apps/control-center/src/domain')
  .filter((file) => compositionImport.test(readFileSync(file, 'utf8')))
  .map((file) => relative(root, file).replaceAll('\\', '/'))
  .sort();

const output = join(root, 'tests/architecture/control-center-legacy-boundaries.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  `${JSON.stringify(
    {
      capturedFor: 'WAVE1_GAP001_GAP002',
      purpose:
        'Freeze pre-existing Control Center Domain → Composition debt. New violations must not be added.',
      domainToComposition,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

const lines = [
  `Captured ${domainToComposition.length} legacy Domain → Composition boundary file(s).`,
  ...domainToComposition.map((file) => `  ${file}`),
  `Baseline written: ${relative(root, output).replaceAll('\\', '/')}`,
  '',
];
process.stdout.write(lines.join('\n'));
