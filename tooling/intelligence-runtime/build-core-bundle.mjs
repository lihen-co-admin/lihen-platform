import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

const entryPoint = path.join(
  root,
  'packages/intelligence-core/src/index.ts',
);

const runtimeBundle = path.join(
  root,
  'supabase/functions/intelligence-runtime/intelligence-core-edge.mjs',
);

const mode = process.argv[2];

if (mode !== '--check' && mode !== '--write') {
  console.error(
    'Usage: node tooling/intelligence-runtime/build-core-bundle.mjs '
      + '--check|--write',
  );
  process.exit(2);
}

async function bundleTo(outfile) {
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    treeShaking: true,
    minify: false,
    outfile,
  });
}

if (mode === '--check') {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'lihen-intelligence-runtime-'),
  );

  const candidate = path.join(
    tempDir,
    'intelligence-core-edge.mjs',
  );

  try {
    await bundleTo(candidate);

    const [generated, existing] = await Promise.all([
      fs.readFile(candidate),
      fs.readFile(runtimeBundle).catch(() => null),
    ]);

    if (existing === null) {
      console.error(
        'LIHEN_INTELLIGENCE_CORE_EDGE_BUNDLE_MISSING',
      );
      process.exitCode = 1;
    } else if (!generated.equals(existing)) {
      console.error(
        'LIHEN_INTELLIGENCE_CORE_EDGE_BUNDLE_DRIFT',
      );
      process.exitCode = 1;
    } else {
      console.log(
        'LIHEN_INTELLIGENCE_CORE_EDGE_BUNDLE_IN_SYNC',
      );
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
} else {
  await bundleTo(runtimeBundle);

  console.log(
    'LIHEN_INTELLIGENCE_CORE_EDGE_BUNDLE_WRITTEN',
  );
}
