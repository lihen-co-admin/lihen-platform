import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const packageRoot = path.join(
  root,
  'packages/document-extraction-benchmark',
);
const srcRoot = path.join(packageRoot, 'src');

function sourceFiles(): readonly string[] {
  return fs
    .readdirSync(srcRoot)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => path.join(srcRoot, name));
}

function source(): string {
  return sourceFiles()
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
}

function importSpecifiers(
  input: string,
): readonly string[] {
  return [
    ...input.matchAll(
      /from\s+['"]([^'"]+)['"]/g,
    ),
  ].map((match) => match[1]);
}

describe('M08-Y PHASE C document extraction benchmark architecture', () => {
  it('exists outside Intelligence Core and reuses its public contracts', () => {
    expect(fs.existsSync(packageRoot)).toBe(true);

    const text = source();

    expect(text).toContain(
      "from '@lihen/intelligence-core'",
    );
    expect(text).toContain(
      'DocumentExtractionPort',
    );
    expect(text).not.toMatch(
      /export\s+interface\s+DocumentExtractionPort\b/,
    );
  });

  it('does not couple the benchmark foundation to DB, Supabase, RPC or Product Master infrastructure', () => {
    const imports = importSpecifiers(source());

    expect(imports).not.toContain(
      '@supabase/supabase-js',
    );
    expect(imports).not.toContain(
      '@lihen/database',
    );
    expect(imports).not.toContain(
      '@lihen/products',
    );

    expect(source()).not.toMatch(
      /\.rpc\s*\(/,
    );
    expect(source()).not.toMatch(
      /createClient\s*\(/,
    );
  });

  it('contains no concrete document provider SDK dependency', () => {
    const imports = importSpecifiers(source());

    for (const specifier of imports) {
      expect(specifier).not.toMatch(
        /^(@google-cloud\/documentai|@azure\/ai-document-intelligence|@aws-sdk\/client-textract|openai|@anthropic-ai\/sdk|@mistralai\/mistralai)$/i,
      );
    }
  });

  it('does not modify or live inside Document Intelligence capability code', () => {
    expect(
      sourceFiles().some((file) =>
        file.includes(
          'packages/intelligence-core/src/capabilities',
        ),
      ),
    ).toBe(false);
  });

  it('keeps the fake provider read-only', () => {
    const fake = fs.readFileSync(
      path.join(
        srcRoot,
        'fake-document-extraction-port.ts',
      ),
      'utf8',
    );

    expect(fake).toContain(
      'readOnly: true',
    );
    expect(fake).not.toMatch(
      /\bfetch\s*\(/,
    );
  });
});
