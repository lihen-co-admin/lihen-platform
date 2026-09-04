import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('WAVE 12 / GAP-039 Unified Intelligence Audit architecture', () => {
  const audit = read(
    'packages/intelligence-core/src/capabilities/audit-intelligence.ts',
  );
  const orchestrator = read('packages/intelligence-core/src/orchestrator.ts');
  const controlPlane = read('packages/intelligence-core/src/control-plane.ts');
  const reviewQueue = read('packages/intelligence-core/src/review-queue.ts');
  const index = read('packages/intelligence-core/src/index.ts');

  it('exports the unified audit capability from intelligence-core', () => {
    expect(index).toContain(
      "export * from './capabilities/audit-intelligence';",
    );
  });

  it('reuses AUDIT_INTELLIGENCE and existing analyze permission', () => {
    expect(audit).toContain("capability: 'AUDIT_INTELLIGENCE'");
    expect(orchestrator).toContain('AUDIT_INTELLIGENCE:');
    expect(orchestrator).toContain(
      'permission: INTELLIGENCE_PERMISSION.ANALYZE',
    );
  });

  it('normalizes existing Orchestrator, human review and Control Plane sources', () => {
    expect(audit).toContain("'INTELLIGENCE_ORCHESTRATOR'");
    expect(audit).toContain("'HUMAN_REVIEW'");
    expect(audit).toContain("'CONTROL_PLANE'");
    expect(audit).toContain('IntelligenceOrchestratorExecution');
    expect(audit).toContain('IntelligenceDecision');
    expect(audit).toContain('ControlledOperationAuditEvent');
  });

  it('preserves existing source authorities instead of creating a second store', () => {
    expect(controlPlane).toContain('getAuditTimeline');
    expect(reviewQueue).toContain('not a second decision store');
    expect(audit).not.toMatch(
      /@supabase|createClient\(|\.from\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/i,
    );
  });

  it('does not mutate decisions or controlled operations', () => {
    expect(audit).not.toContain('confirmPreparedControlPlaneIntent(');
    expect(audit).not.toContain('.confirmOperation(');
    expect(audit).not.toContain('prepareApprovedRecommendationForControlPlane(');
  });

  it('does not implement GAP-040 RLS, GAP-041 idempotency or GAP-042 observability', () => {
    expect(audit).not.toMatch(
      /row level security|create policy|service_role|bypass_rls/i,
    );
    expect(audit).not.toMatch(
      /idempotencyStore|idempotencyRepository|dedupeKey/i,
    );
    expect(audit).not.toMatch(
      /opentelemetry|otel|spanId|traceparent|metrics exporter/i,
    );
  });
});
