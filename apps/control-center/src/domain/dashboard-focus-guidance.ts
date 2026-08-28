import type {
  DashboardOperationalFocus,
  DashboardOperationalHealth,
} from './dashboard-operational-health';

export type DashboardFocusGuidanceTone = 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'INFO';

export interface DashboardFocusGuidance {
  readonly focus: DashboardOperationalFocus;
  readonly tone: DashboardFocusGuidanceTone;
  readonly title: string;
  readonly explanation: string;
  readonly actionLabel?: string;
  readonly targetRoute?: string;
  readonly navigationOnly: true;
  readonly mayMutateDomain: false;
}

const routes: Partial<
  Record<DashboardOperationalFocus, { readonly actionLabel: string; readonly targetRoute: string }>
> = {
  INTEGRITY: {
    actionLabel: 'Revisar integridad',
    targetRoute: '/operations',
  },
  HUMAN_DECISION: {
    actionLabel: 'Abrir controles',
    targetRoute: '/operations',
  },
  ORDERS: {
    actionLabel: 'Revisar pedidos',
    targetRoute: '/orders',
  },
  PURCHASES: {
    actionLabel: 'Revisar compras',
    targetRoute: '/purchases',
  },
  INVENTORY: {
    actionLabel: 'Revisar inventario',
    targetRoute: '/inventory',
  },
};

function titleForFocus(focus: DashboardOperationalFocus): string {
  switch (focus) {
    case 'INTEGRITY':
      return 'Resolver integridad antes de continuar';
    case 'INTELLIGENCE_ASSURANCE':
      return 'Revisar calidad de Intelligence';
    case 'HUMAN_DECISION':
      return 'Hay decisiones humanas pendientes';
    case 'ORDERS':
      return 'Priorizar pedidos abiertos';
    case 'PURCHASES':
      return 'Continuar abastecimiento';
    case 'INVENTORY':
      return 'Revisar inventario pendiente';
    case 'MONITOR':
      return 'Operación estable';
  }
}

function toneForHealth(
  health: DashboardOperationalHealth,
): DashboardFocusGuidanceTone {
  if (health.status === 'BLOCKED') return 'CRITICAL';
  if (health.status === 'ATTENTION') return 'WARNING';
  if (health.nextFocus === 'MONITOR') return 'SUCCESS';
  return 'INFO';
}

export function evaluateDashboardFocusGuidance(
  health: DashboardOperationalHealth,
): DashboardFocusGuidance {
  const route = routes[health.nextFocus];

  return {
    focus: health.nextFocus,
    tone: toneForHealth(health),
    title: titleForFocus(health.nextFocus),
    explanation:
      health.blockers.length > 0
        ? `Bloqueos: ${health.blockers.join(' · ')}`
        : health.attentionItems.length > 0
          ? `Atención: ${health.attentionItems.join(' · ')}`
          : health.explanation,
    ...(route ? route : {}),
    navigationOnly: true,
    mayMutateDomain: false,
  };
}
