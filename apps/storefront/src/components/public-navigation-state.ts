export interface PublicNavigationStateInput {
  readonly menuOpen: boolean;
  readonly activeMegaKey: string | null;
  readonly desktop: boolean;
}

export interface PublicNavigationStateResult {
  readonly menuOpen: boolean;
  readonly activeMegaKey: string | null;
  readonly lockBodyScroll: boolean;
  readonly menuLabel: 'Abrir menú' | 'Cerrar menú';
}

export function resolvePublicNavigationState(
  input: PublicNavigationStateInput,
): PublicNavigationStateResult {
  const menuOpen = input.desktop ? false : input.menuOpen;

  return {
    menuOpen,
    activeMegaKey: input.activeMegaKey,
    lockBodyScroll: menuOpen && !input.desktop,
    menuLabel: menuOpen ? 'Cerrar menú' : 'Abrir menú',
  };
}

export function shouldCloseNavigationOnRouteChange(
  href: string,
): boolean {
  return href.trim().startsWith('#');
}
