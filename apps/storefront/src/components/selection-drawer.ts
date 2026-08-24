import { buildSelectionWhatsAppUrl } from './whatsapp';
import { clearSelection, readSelection, removeFromSelection, subscribeSelection, type SelectedProduct } from './selection-store';
import { escapeHtml, money } from './storefront-product';

function renderItems(items: SelectedProduct[]): string {
  if (items.length === 0) return '<div class="selection-empty"><strong>Tu selección está vacía.</strong><p>Agrega productos para consultarlos juntos por WhatsApp.</p></div>';
  return items.map((item) => `
    <article class="selection-item">
      <img src="${item.imageUrl}" alt="" loading="lazy" decoding="async" />
      <div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.brand ?? 'LIHEN.CO')}</span><b>${money(item.price)}</b></div>
      <button type="button" data-selection-remove="${item.productId}" aria-label="Quitar ${escapeHtml(item.name)}">×</button>
    </article>
  `).join('');
}

export function renderSelectionDrawer(): string {
  return `
    <div class="selection-overlay" data-selection-overlay hidden></div>
    <aside class="selection-drawer" data-selection-drawer aria-label="Mi selección" aria-hidden="true">
      <div class="selection-drawer__header"><div><p class="lihen-eyebrow">LIHEN.CO</p><h2>Mi selección</h2></div><button type="button" data-selection-close aria-label="Cerrar selección">×</button></div>
      <div class="selection-drawer__body" data-selection-body></div>
      <div class="selection-drawer__footer" data-selection-footer></div>
    </aside>
  `;
}

export function bindSelectionDrawer(root: HTMLElement): void {
  const drawer = root.querySelector<HTMLElement>('[data-selection-drawer]');
  const overlay = root.querySelector<HTMLElement>('[data-selection-overlay]');
  const body = root.querySelector<HTMLElement>('[data-selection-body]');
  const footer = root.querySelector<HTMLElement>('[data-selection-footer]');
  const trigger = root.querySelector<HTMLButtonElement>('[data-selection-trigger]');
  const close = root.querySelector<HTMLButtonElement>('[data-selection-close]');
  if (!drawer || !overlay || !body || !footer || !trigger || !close) return;

  const render = (items = readSelection()): void => {
    body.innerHTML = renderItems(items);
    footer.innerHTML = items.length > 0 ? `
      <a class="lihen-button lihen-button--dark" href="${buildSelectionWhatsAppUrl(items)}" target="_blank" rel="noreferrer">Consultar ${items.length} producto${items.length === 1 ? '' : 's'} por WhatsApp</a>
      <button type="button" class="selection-clear" data-selection-clear>Vaciar selección</button>
    ` : '';
    root.querySelectorAll<HTMLElement>('[data-selection-count]').forEach((counter) => { counter.textContent = String(items.length); });
    body.querySelectorAll<HTMLButtonElement>('[data-selection-remove]').forEach((button) => {
      button.addEventListener('click', () => removeFromSelection(button.dataset.selectionRemove ?? ''));
    });
    footer.querySelector<HTMLButtonElement>('[data-selection-clear]')?.addEventListener('click', clearSelection);
  };

  const setOpen = (open: boolean): void => {
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    overlay.hidden = !open;
    document.body.classList.toggle('selection-open', open);
    if (open) close.focus();
  };

  trigger.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  overlay.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) setOpen(false);
  });
  subscribeSelection(render);
  render();
}
