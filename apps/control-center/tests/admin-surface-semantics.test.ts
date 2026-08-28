import { describe, expect, it } from 'vitest';
import {
  resolveIntelligencePanelEmptyState,
  resolveOperationalNoticeSemantics,
} from '../src/domain/admin-surface-semantics';

describe('resolveOperationalNoticeSemantics', () => {
  it('uses assertive alert semantics only for critical notices', () => {
    expect(resolveOperationalNoticeSemantics('critical')).toEqual({
      role: 'alert',
      ariaLive: 'assertive',
    });
  });

  it('uses polite status semantics for warnings', () => {
    expect(resolveOperationalNoticeSemantics('warning')).toEqual({
      role: 'status',
      ariaLive: 'polite',
    });
  });

  it('does not create unnecessary live regions for informational notices', () => {
    expect(resolveOperationalNoticeSemantics('info')).toEqual({});
    expect(resolveOperationalNoticeSemantics('success')).toEqual({});
  });
});

describe('resolveIntelligencePanelEmptyState', () => {
  it('returns an accessible empty state when there are no insights', () => {
    const result = resolveIntelligencePanelEmptyState(0);

    expect(result?.role).toBe('status');
    expect(result?.ariaLive).toBe('polite');
    expect(result?.title).toBe('Sin alertas de Intelligence');
  });

  it('does not render an empty state when insights exist', () => {
    expect(resolveIntelligencePanelEmptyState(1)).toBeNull();
  });

  it('treats any positive count as populated without inventing thresholds', () => {
    expect(resolveIntelligencePanelEmptyState(25)).toBeNull();
  });
});
