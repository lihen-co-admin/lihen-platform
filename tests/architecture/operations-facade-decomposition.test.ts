import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('WAVE 3 / GAP-009 Operations Facade decomposition', () => {
  it('preserves createOperationsComposition as the compatibility facade', () => {
    const source = read('apps/control-center/src/composition/operations.ts');

    expect(source).toContain('export function createOperationsComposition');
    expect(source).toContain(
      'export const operationsComposition = createOperationsComposition();',
    );
  });

  it('moves public data contracts out of the facade while re-exporting compatibility', () => {
    const facade = read('apps/control-center/src/composition/operations.ts');
    const contracts = read(
      'apps/control-center/src/composition/operations-contracts.ts',
    );

    expect(facade).not.toMatch(/export interface OperationalDashboardSummary/);
    expect(facade).toContain("from './operations-contracts'");
    expect(facade).toContain("export type {");
    expect(contracts).toContain('export interface OperationalDashboardSummary');
    expect(contracts).toContain('export interface ControlCenterOperationPreview');
    expect(contracts).toContain(
      'export interface ControlCenterOperationReleaseAuthorizationGuard',
    );
  });

  it('moves primitive mapping helpers out of the facade without changing database access', () => {
    const facade = read('apps/control-center/src/composition/operations.ts');
    const mappers = read(
      'apps/control-center/src/composition/operations-mappers.ts',
    );

    expect(facade).not.toMatch(/function numberValue\(/);
    expect(facade).not.toMatch(/function rowObject\(/);
    expect(facade).not.toMatch(/function firstRpcRow\(/);
    expect(facade).not.toMatch(/function booleanValue\(/);
    expect(facade).toContain("from './operations-mappers'");
    expect(mappers).not.toMatch(/@supabase\/|@lihen\/database|\.rpc\s*\(/i);
  });

  it('keeps GAP-008 bound to the same compatibility facade', () => {
    const adapter = read(
      'apps/control-center/src/composition/intelligence-control-plane.ts',
    );

    expect(adapter).toContain("from './operations'");
    expect(adapter).toContain('createOperationsComposition');
  });

  it('does not add new RPC names, SQL, release or canary mutation in extracted modules', () => {
    const extracted = [
      read('apps/control-center/src/composition/operations-contracts.ts'),
      read('apps/control-center/src/composition/operations-mappers.ts'),
    ].join('\n');

    expect(extracted).not.toMatch(/\.rpc\s*\(|select\s+.+\s+from|insert\s+into/i);
    expect(extracted).not.toMatch(/release.*=\s*true|canary.*=\s*true/i);
  });

  it('keeps Supabase access in the existing operations facade for this conservative step', () => {
    const facade = read('apps/control-center/src/composition/operations.ts');

    expect(facade).toContain(
      "import { getBrowserSupabaseClient, parseBrowserEnv } from '@lihen/database';",
    );
    expect(facade).toContain('const client = getBrowserSupabaseClient(env);');
  });
});
