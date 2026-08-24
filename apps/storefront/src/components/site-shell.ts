import { bindHomePageInteractions, renderHomePage } from './home-page';
import { renderSiteFooter } from './site-footer';
import { bindSiteHeaderInteractions, renderSiteHeader } from './site-header';

export function renderSiteShell(): string {
  return `
    <a class="skip-link" href="#contenido">Saltar al contenido</a>
    ${renderSiteHeader()}
    <main id="contenido">${renderHomePage()}</main>
    ${renderSiteFooter()}
  `;
}

export function bindSiteShellInteractions(root: HTMLElement): void {
  bindSiteHeaderInteractions(root);
  bindHomePageInteractions(root);
}
