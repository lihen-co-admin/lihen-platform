import type { DashboardOperationalFocus } from './dashboard-operational-health';

export type AdminExperienceState = 'LOADING' | 'ERROR' | 'READY' | 'EMPTY';

export interface AdminExperienceStateInput {
  readonly isLoading: boolean;
  readonly errorMessage: string;
  readonly hasData: boolean;
}

export interface AdminExperienceStateResult {
  readonly state: AdminExperienceState;
  readonly role?: 'alert' | 'status';
  readonly ariaLive?: 'assertive' | 'polite';
  readonly ariaBusy: boolean;
  readonly title: string;
  readonly message: string;
}

const focusLabels: Record<DashboardOperationalFocus, string> = {
  INTEGRITY: 'Integridad',
  INTELLIGENCE_ASSURANCE: 'Revisión de Intelligence',
  HUMAN_DECISION: 'Decisión humana',
  ORDERS: 'Pedidos',
  PURCHASES: 'Compras',
  INVENTORY: 'Inventario',
  MONITOR: 'Monitoreo',
};

export function formatOperationalFocusLabel(
  focus: DashboardOperationalFocus,
): string {
  return focusLabels[focus];
}

export function resolveAdminExperienceState(
  input: AdminExperienceStateInput,
): AdminExperienceStateResult {
  if (input.errorMessage.trim()) {
    return {
      state: 'ERROR',
      role: 'alert',
      ariaLive: 'assertive',
      ariaBusy: false,
      title: 'No pudimos cargar el centro de control',
      message: input.errorMessage.trim(),
    };
  }

  if (input.isLoading) {
    return {
      state: 'LOADING',
      role: 'status',
      ariaLive: 'polite',
      ariaBusy: true,
      title: 'Preparando tu centro de control',
      message: 'Estamos consultando el estado operativo de LIHEN en DEV.',
    };
  }

  if (!input.hasData) {
    return {
      state: 'EMPTY',
      role: 'status',
      ariaLive: 'polite',
      ariaBusy: false,
      title: 'Aún no hay información para mostrar',
      message: 'Cuando exista información operativa disponible, aparecerá aquí.',
    };
  }

  return {
    state: 'READY',
    ariaBusy: false,
    title: 'Centro de control disponible',
    message: 'La información operativa está lista para revisión.',
  };
}
