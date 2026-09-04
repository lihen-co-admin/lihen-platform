import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('WAVE 9 / GAP-032 LIHEN Cloud Workspace UI architecture', () => {
  const page = read('apps/control-center/src/pages/CloudWorkspacePage.tsx');
  const composition = read('apps/control-center/src/composition/cloud-workspace.ts');
  const app = read('apps/control-center/src/app/App.tsx');
  const shell = read('apps/control-center/src/components/AppShell.tsx');
  const migration = read(
    'database/migrations/20260904041500_wave9_gap032_cloud_workspace_read_access.sql',
  );

  it('reuses the existing Control Center shell and adds one workspace route', () => {
    expect(app).toContain("import { CloudWorkspacePage } from '../pages/CloudWorkspacePage';");
    expect(app).toContain('<Route path="/cloud" element={<CloudWorkspacePage />} />');
    expect(shell).toContain("{ to: '/cloud', label: 'Workspace', icon: '☁' }");
  });

  it('reads the GAP-031 registry instead of creating a second storage authority', () => {
    expect(composition).toContain(".from('unified_asset_artifact_registry')");
    expect(composition).toContain("source: 'public.unified_asset_artifact_registry'");
    expect(composition).toContain('readOnly: true');
    expect(composition).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  });

  it('keeps GAP-032 UI explicitly read-only', () => {
    expect(page).toContain('READ ONLY · DEV');
    expect(page).toContain('no habilita escrituras sobre buckets');
    expect(page).not.toMatch(/type="file"|onUpload|handleUpload|handleDelete|handlePublish/i);
  });

  it('adds only the minimum RLS SELECT policy required by security_invoker', () => {
    expect(migration).toContain('for select');
    expect(migration).toContain('to authenticated');
    expect(migration).toContain("p.authorization_status = 'ACTIVE'");
    expect(migration).toContain("p.role_code in ('OWNER', 'ADMIN')");
    expect(migration).toContain("'lihen-product-originals'");
    expect(migration).toContain("'lihen-product-web'");
    expect(migration).toContain("'catalog-assets'");
    expect(migration).toContain("'catalog-pdf-artifacts'");
    expect(migration).not.toMatch(/for insert|for update|for delete/i);
  });

  it('does not introduce Assistant behavior into GAP-032', () => {
    expect(page).not.toMatch(/assistant|chatbot|resolver context/i);
    expect(composition).not.toMatch(/assistant|orchestrator|generate|recommend/i);
  });
});
