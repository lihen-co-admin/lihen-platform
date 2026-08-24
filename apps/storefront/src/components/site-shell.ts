import { renderSiteFooter } from './site-footer';
import { bindSiteHeaderInteractions, renderSiteHeader } from './site-header';
import { bindSelectionDrawer, renderSelectionDrawer } from './selection-drawer';
import { bindStorefrontRouter } from './storefront-router';

export function renderSiteShell(): string {
  return `
    <a class="skip-link" href="#contenido">Saltar al contenido</a>
    ${renderSiteHeader()}
    <main id="contenido" tabindex="-1"></main>
    ${renderSiteFooter()}
    ${renderSelectionDrawer()}
  `;
}

export function bindSiteShellInteractions(root: HTMLElement): void {
  bindSiteHeaderInteractions(root);
  bindSelectionDrawer(root);
  bindStorefrontRouter(root);
}
