import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagesDir = 'apps/control-center/src/pages';

const excludedFromAppShellRhythm = new Set([
  'LoginPage.tsx',
  'BootstrapAdminPage.tsx',
  'CatalogPdfRenderPage.tsx',
]);

describe('LIHEN Control Center global visual system', () => {
  it('gives every audited AppShell page the canonical stack rhythm', () => {
    const pages = readdirSync(pagesDir)
      .filter((name) => name.endsWith('.tsx'))
      .filter((name) => !excludedFromAppShellRhythm.has(name));

    const missing = pages.filter((name) => {
      const source = readFileSync(join(pagesDir, name), 'utf8');
      return !/className="[^"]*\bstack\b[^"]*"/.test(source);
    });

    expect(missing).toEqual([]);
  });

  it('contains no legacy table-summary page headers', () => {
    const pages = readdirSync(pagesDir)
      .filter((name) => name.endsWith('.tsx'));

    const legacy = pages.filter((name) =>
      readFileSync(join(pagesDir, name), 'utf8')
        .includes('className="table-summary"'),
    );

    expect(legacy).toEqual([]);
  });

  it('uses semantic card structure for Assistant conversation state', () => {
    const assistant = readFileSync(
      join(pagesDir, 'AssistantPage.tsx'),
      'utf8',
    );

    expect(assistant).toContain('<div className="card stack">');
    expect(assistant).toContain('<h2>Conversación gobernada</h2>');
    expect(assistant).not.toContain('className="table-summary"');
  });

  it('preserves natural wrapping in operational definition lists', () => {
    const css = readFileSync(
      'apps/control-center/src/styles/app.css',
      'utf8',
    );

    expect(css).toContain(
      '.operation-preview-list dd { margin: 0; overflow-wrap: break-word; word-break: normal; }',
    );

    expect(css).toContain(
      '.probe-definition-list dd { margin: 0; overflow-wrap: break-word; word-break: normal; }',
    );

    expect(css).not.toContain(
      '.operation-preview-list dd { margin: 0; overflow-wrap: anywhere; }',
    );

    expect(css).not.toContain(
      '.probe-definition-list dd { margin: 0; overflow-wrap: anywhere; }',
    );
  });
  it('keeps sr-only labels visually hidden but accessible', () => {
    const css = readFileSync(
      'apps/control-center/src/styles/app.css',
      'utf8',
    );

    expect(css).toContain('.sr-only {');
    expect(css).toContain('position: absolute;');
    expect(css).toContain('width: 1px;');
    expect(css).toContain('height: 1px;');
    expect(css).toContain('overflow: hidden;');
    expect(css).toContain('white-space: nowrap;');
  });

});
