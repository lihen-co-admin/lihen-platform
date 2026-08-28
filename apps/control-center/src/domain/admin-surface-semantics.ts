export type OperationalNoticeTone = 'info' | 'success' | 'warning' | 'critical';

export interface OperationalNoticeSemantics {
  readonly role?: 'alert' | 'status';
  readonly ariaLive?: 'assertive' | 'polite';
}

export function resolveOperationalNoticeSemantics(
  tone: OperationalNoticeTone,
): OperationalNoticeSemantics {
  if (tone === 'critical') {
    return {
      role: 'alert',
      ariaLive: 'assertive',
    };
  }

  if (tone === 'warning') {
    return {
      role: 'status',
      ariaLive: 'polite',
    };
  }

  return {};
}

export interface IntelligencePanelEmptyState {
  readonly title: string;
  readonly message: string;
  readonly role: 'status';
  readonly ariaLive: 'polite';
}

export function resolveIntelligencePanelEmptyState(
  insightCount: number,
): IntelligencePanelEmptyState | null {
  if (insightCount > 0) return null;

  return {
    title: 'Sin alertas de Intelligence',
    message: 'No hay señales operativas que requieran atención en este momento.',
    role: 'status',
    ariaLive: 'polite',
  };
}
