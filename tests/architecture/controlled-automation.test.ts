import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('WAVE 11 / GAP-038 Controlled Automation architecture', () => {
  const automation = read(
    'packages/intelligence-core/src/capabilities/controlled-automation.ts',
  );
  const orchestrator = read('packages/intelligence-core/src/orchestrator.ts');
  const controlPlane = read('packages/intelligence-core/src/control-plane.ts');
  const index = read('packages/intelligence-core/src/index.ts');

  it('exports Controlled Automation from intelligence-core', () => {
    expect(index).toContain(
      "export * from './capabilities/controlled-automation';",
    );
  });

  it('reuses AUTOMATION + PREPARE_ACTION instead of mutation permission', () => {
    expect(automation).toContain("capability: 'AUTOMATION'");
    expect(orchestrator).toContain('AUTOMATION:');
    expect(orchestrator).toContain(
      'permission: INTELLIGENCE_PERMISSION.PREPARE_ACTION',
    );
  });

  it('requires approval mode ALWAYS_REQUIRED and human review', () => {
    expect(automation).toContain("approvalMode: 'ALWAYS_REQUIRED'");
    expect(automation).toContain('AUTOMATION_APPROVAL_BYPASS_FORBIDDEN');
    expect(automation).toContain('requiresHumanReview: true');
  });

  it('reuses the existing approved recommendation Control Plane handoff', () => {
    expect(automation).toContain(
      'prepareApprovedRecommendationForControlPlane',
    );
    expect(controlPlane).toContain(
      'Recommendation -> Human Decision(APPROVE)',
    );
  });

  it('never confirms or executes a controlled operation automatically', () => {
    expect(automation).not.toContain('confirmPreparedControlPlaneIntent(');
    expect(automation).not.toContain('.confirmOperation(');
    expect(automation).not.toMatch(
      /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/,
    );
  });

  it('does not implement a scheduler, worker or GAP-041 idempotency layer', () => {
    expect(automation).not.toMatch(
      /setInterval|setTimeout|node-cron|bullmq|agenda|scheduler\.|worker_threads|queue\.add/i,
    );
    expect(automation).not.toMatch(
      /idempotencyKey|dedupeKey|idempotencyStore|idempotencyRepository/i,
    );
  });
});
