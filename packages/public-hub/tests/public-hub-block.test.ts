import { describe, expect, it } from 'vitest';
import {
  getPublicHubBlockPublicationState,
  getPublicHubBlockValidationIssues,
  isPublicHubBlockActiveAt,
  validatePublicHubBlockDraft,
} from '../src/domain/public-hub-block';

describe('Public Hub block domain', () => {
  it('requires canonical product id for PRODUCT blocks', () => {
    expect(() => validatePublicHubBlockDraft({ blockType: 'PRODUCT' })).toThrow(/producto canónico/i);
  });

  it('requires destination for LINK blocks', () => {
    expect(() => validatePublicHubBlockDraft({ blockType: 'LINK', title: 'Tienda' })).toThrow(/URL de destino/i);
  });

  it('accepts a scheduled published block only inside its window', () => {
    const block = {
      status: 'PUBLISHED' as const,
      startsAt: '2026-09-01T00:00:00Z',
      endsAt: '2026-09-06T00:00:00Z',
    };
    expect(isPublicHubBlockActiveAt(block, new Date('2026-09-03T12:00:00Z'))).toBe(true);
    expect(isPublicHubBlockActiveAt(block, new Date('2026-08-31T23:59:59Z'))).toBe(false);
    expect(isPublicHubBlockActiveAt(block, new Date('2026-09-06T00:00:00Z'))).toBe(false);
  });

  it('classifies publication state without adding contradictory persisted flags', () => {
    const scheduled = { status: 'PUBLISHED' as const, startsAt: '2026-09-02T00:00:00Z' };
    const expired = { status: 'PUBLISHED' as const, endsAt: '2026-09-01T00:00:00Z' };
    expect(getPublicHubBlockPublicationState(scheduled, new Date('2026-09-01T12:00:00Z'))).toBe('SCHEDULED');
    expect(getPublicHubBlockPublicationState(expired, new Date('2026-09-01T12:00:00Z'))).toBe('EXPIRED');
    expect(getPublicHubBlockPublicationState({ status: 'PUBLISHED' }, new Date('2026-09-01T12:00:00Z'))).toBe('LIVE');
  });


  it('returns actionable validation issues for an incomplete product block', () => {
    expect(getPublicHubBlockValidationIssues({ blockType: 'PRODUCT' })).toEqual([
      expect.objectContaining({ code: 'PRODUCT_REQUIRED' }),
    ]);
  });

  it('rejects malformed scheduling timestamps before persistence', () => {
    expect(getPublicHubBlockValidationIssues({
      blockType: 'LINK',
      title: 'Tienda',
      targetUrl: 'https://lihen.co',
      startsAt: 'not-a-date',
    })).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_STARTS_AT' })]));
  });

  it('does not expose hidden content as active', () => {
    expect(isPublicHubBlockActiveAt({ status: 'HIDDEN' }, new Date())).toBe(false);
  });
});
