export type PublicExperienceState = 'LOADING' | 'READY' | 'EMPTY' | 'ERROR';

export interface PublicExperienceStateInput {
  readonly isLoading: boolean;
  readonly itemCount: number;
  readonly errorMessage?: string;
  readonly emptyMessage: string;
  readonly readyMessage: string;
}

export interface PublicExperienceStateResult {
  readonly state: PublicExperienceState;
  readonly role: 'status' | 'alert';
  readonly ariaLive: 'polite' | 'assertive';
  readonly ariaBusy: boolean;
  readonly message: string;
}

export function resolvePublicExperienceState(
  input: PublicExperienceStateInput,
): PublicExperienceStateResult {
  const errorMessage = input.errorMessage?.trim() ?? '';

  if (errorMessage) {
    return {
      state: 'ERROR',
      role: 'alert',
      ariaLive: 'assertive',
      ariaBusy: false,
      message: errorMessage,
    };
  }

  if (input.isLoading) {
    return {
      state: 'LOADING',
      role: 'status',
      ariaLive: 'polite',
      ariaBusy: true,
      message: 'Cargando productos…',
    };
  }

  if (input.itemCount <= 0) {
    return {
      state: 'EMPTY',
      role: 'status',
      ariaLive: 'polite',
      ariaBusy: false,
      message: input.emptyMessage,
    };
  }

  return {
    state: 'READY',
    role: 'status',
    ariaLive: 'polite',
    ariaBusy: false,
    message: input.readyMessage,
  };
}

export function publicScrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
