import { describe, expect, it } from 'vitest';
import { evaluateGovernanceAssurance, evaluateGovernanceEvidence } from '../src/domain/governance-evidence';

const NOW = new Date('2026-08-27T20:00:00.000Z');

function governanceEvent(overrides: Partial<Parameters<typeof evaluateGovernanceEvidence>[0]['governanceAudit'][number]> = {}) {
  return {
    id: 'g-1',
    operationCode: 'CATALOG_PREVIEW',
    actorId: 'actor-1',
    status: 'PREVIEWED',
    correlationKey: 'corr-1',
    occurredAt: new Date('2026-08-27T19:00:00.000Z'),
    ...overrides,
  };
}

function operationEvent(overrides: Partial<Parameters<typeof evaluateGovernanceEvidence>[0]['operationTimeline'][number]> = {}) {
  return {
    domainCode: 'CATALOG',
    operationType: 'PREVIEW',
    operationKey: 'op-1',
    actorId: 'actor-1',
    occurredAt: new Date('2026-08-27T19:30:00.000Z'),
    ...overrides,
  };
}

describe('governance evidence', () => {
  it('is ready with recent and well formed evidence', () => {
    const result = evaluateGovernanceEvidence({ governanceAudit: [governanceEvent()], operationTimeline: [operationEvent()], now: NOW });
    expect(result.status).toBe('READY');
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('reviews an empty evidence window instead of inventing activity', () => {
    const result = evaluateGovernanceEvidence({ governanceAudit: [], operationTimeline: [], now: NOW });
    expect(result.status).toBe('REVIEW');
    expect(result.warnings).toContain('GOVERNANCE_AUDIT_EMPTY');
    expect(result.warnings).toContain('OPERATION_TIMELINE_EMPTY');
  });

  it('reviews stale evidence without opening execution', () => {
    const stale = new Date('2026-08-20T10:00:00.000Z');
    const result = evaluateGovernanceEvidence({
      governanceAudit: [governanceEvent({ occurredAt: stale })],
      operationTimeline: [operationEvent({ occurredAt: stale })],
      now: NOW,
    });
    expect(result.status).toBe('REVIEW');
    expect(result.warnings).toContain('GOVERNANCE_AUDIT_STALE');
    expect(result.warnings).toContain('OPERATION_TIMELINE_STALE');
  });

  it('blocks malformed evidence', () => {
    const result = evaluateGovernanceEvidence({
      governanceAudit: [governanceEvent({ actorId: '' })],
      operationTimeline: [operationEvent()],
      now: NOW,
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('GOVERNANCE_EVENT_MALFORMED');
  });

  it('blocks evidence materially dated in the future', () => {
    const result = evaluateGovernanceEvidence({
      governanceAudit: [governanceEvent({ occurredAt: new Date('2026-08-28T20:00:00.000Z') })],
      operationTimeline: [operationEvent()],
      now: NOW,
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContain('GOVERNANCE_EVENT_FUTURE_DATED');
  });

  it('aggregates readiness and evidence conservatively', () => {
    expect(evaluateGovernanceAssurance('READY', 'READY').status).toBe('READY');
    expect(evaluateGovernanceAssurance('READY', 'REVIEW').status).toBe('REVIEW');
    expect(evaluateGovernanceAssurance('REVIEW', 'BLOCKED').status).toBe('BLOCKED');
  });
});
