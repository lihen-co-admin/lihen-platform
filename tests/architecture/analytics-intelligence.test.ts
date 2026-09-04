import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('WAVE 11 / GAP-037 Analytics Intelligence architecture', () => {
  const analytics = read(
    'packages/intelligence-core/src/capabilities/analytics-intelligence.ts',
  );
  const orchestrator = read('packages/intelligence-core/src/orchestrator.ts');
  const index = read('packages/intelligence-core/src/index.ts');

  it('exports Analytics Intelligence from intelligence-core', () => {
    expect(index).toContain(
      "export * from './capabilities/analytics-intelligence';",
    );
  });

  it('reuses the existing ANALYTICS capability and analyze permission', () => {
    expect(analytics).toContain("capability: 'ANALYTICS'");
    expect(orchestrator).toContain('ANALYTICS:');
    expect(orchestrator).toContain(
      'permission: INTELLIGENCE_PERMISSION.ANALYZE',
    );
  });

  it('computes deterministic signals from a governed metric snapshot', () => {
    expect(analytics).toContain("'CURRENT_VALUE'");
    expect(analytics).toContain("'DELTA'");
    expect(analytics).toContain("'RATIO_CHANGE'");
    expect(analytics).toContain("'OUT_OF_EXPECTED_RANGE'");
    expect(analytics).toContain('analyticsSnapshot');
  });

  it('does not query persistence or duplicate the operational dashboard authority', () => {
    expect(analytics).not.toMatch(
      /@supabase|createClient\(|getBrowserSupabaseClient|\.from\(|\.rpc\(|select\s+.+from/i,
    );
    expect(analytics).not.toMatch(
      /operational_dashboard_summary.*select|create\s+view|create\s+table/i,
    );
  });

  it('does not mutate, schedule or automate corrective actions', () => {
    expect(analytics).not.toMatch(
      /\.insert\(|\.update\(|\.delete\(|\.upsert\(|confirmOperation\(|prepareOperation\(/i,
    );
    expect(analytics).not.toMatch(
      /setInterval|setTimeout|cron|scheduleJob|AUTOMATION/i,
    );
  });

  it('does not pretend deterministic deltas are forecasts or predictions', () => {
    expect(analytics).not.toMatch(
      /forecast|prediction|predictive|machine learning|regression|prophet/i,
    );
    expect(analytics).toContain(
      'Analytics remains read-only and does not execute corrective actions.',
    );
  });
});
