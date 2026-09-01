import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const core = () =>
  readFileSync(
    join(root, 'packages/intelligence-core/src/control-plane.ts'),
    'utf8',
  );
const adapter = () =>
  readFileSync(
    join(
      root,
      'apps/control-center/src/composition/intelligence-control-plane.ts',
    ),
    'utf8',
  );

describe('GAP-008 Intelligence ↔ Existing Control Plane architecture', () => {
  it('keeps the core free of Supabase, React, SQL and RPC', () => {
    const source = core();

    expect(source).not.toMatch(/@supabase\/|@lihen\/database|react/i);
    expect(source).not.toMatch(/\.rpc\s*\(|\.from\s*\(|insert\s+into|update\s+\w+\s+set/i);
  });

  it('requires Human Decision before preparing a governed operation', () => {
    const source = core();

    expect(source).toContain("decision.decision !== 'APPROVE'");
    expect(source).toContain('HUMAN_DECISION_NOT_APPROVED');
    expect(source).toContain('DECISION_RECOMMENDATION_MISMATCH');
    expect(source).toContain('CORRELATION_MISMATCH');
  });

  it('prepares without automatic confirmation', () => {
    const source = core();
    const prepareStart = source.indexOf(
      'export async function prepareApprovedRecommendationForControlPlane',
    );
    const confirmStart = source.indexOf(
      'export async function confirmPreparedControlPlaneIntent',
    );
    const prepareSection = source.slice(prepareStart, confirmStart);

    expect(prepareSection).toContain('validateOperationPayload');
    expect(prepareSection).toContain('prepareOperation');
    expect(prepareSection).not.toContain('confirmOperation(');
  });

  it('adapts to the existing operations facade instead of creating a second command engine', () => {
    const source = adapter();

    expect(source).toContain("from './operations'");
    expect(source).toContain('operations.validateOperationPayload');
    expect(source).toContain('operations.prepareOperation');
    expect(source).toContain('operations.confirmOperation');
    expect(source).toContain('operations.getControlCenterAuditTimeline');

    // Guard actual implementation coupling, not prose/comments.
    expect(source).not.toMatch(/from\s+['"]@supabase\//i);
    expect(source).not.toMatch(/from\s+['"]@lihen\/database['"]/i);
    expect(source).not.toMatch(/\bclient\.rpc\s*\(/i);
    expect(source).not.toMatch(/\bcreateClient\s*\(/i);
  });

  it('does not introduce provider, social or publishing execution', () => {
    const combined = `${core()}\n${adapter()}`;

    expect(combined).not.toMatch(/openai|anthropic|gemini|tiktok|instagram|facebook/i);
    expect(combined).not.toContain('SocialPublishingPort');
    expect(combined).not.toMatch(/publishCatalog|postFinance|changeLifecycle/i);
  });
});
