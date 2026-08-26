import { buildSelectionWhatsAppUrl } from './whatsapp';
import {
  clearSelection,
  decrementSelectionQuantity,
  incrementSelectionQuantity,
  readSelection,
  removeFromSelection,
  subscribeSelection,
  type SelectedProduct,
} from './selection-store';
import { escapeHtml, money } from './storefront-product';

function renderItems(items: SelectedProduct[]): string {
  if (items.length === 0) return '<div class="selection-empty"><strong>Tu selección está vacía.</strong><p>Agrega productos para consultarlos juntos por WhatsApp.</p></div>';
  return items.map((item) => `
    <article class="selection-item">
      <img src="${item.imageUrl}" alt="" loading="lazy" decoding="async" />
      <div class="selection-item__content">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.brand ?? 'LIHEN.CO')}</span>
        <b>${money(item.price)}</b>
        <div class="selection-item__quantity" aria-label="Cantidad de ${escapeHtml(item.name)}">
          <button type="button" data-selection-decrement="${item.productId}" aria-label="Disminuir cantidad de ${escapeHtml(item.name)}">−</button>
          <span aria-live="polite">${item.quantity}</span>
          <button type="button" data-selection-increment="${item.productId}" aria-label="Aumentar cantidad de ${escapeHtml(item.name)}">+</button>
        </div>
      </div>
      <button class="selection-item__remove" type="button" data-selection-remove="${item.productId}" aria-label="Quitar ${escapeHtml(item.name)}">×</button>
    </article>
  `).join('');
}

function syncProductSelectionControls(items: SelectedProduct[]): void {
  const byId = new Map(items.map((item) => [item.productId, item]));
  document.querySelectorAll<HTMLButtonElement>('[data-product-select]').forEach((control) => {
    const item = byId.get(control.dataset.productSelect ?? '');
    const active = Boolean(item);
    control.classList.toggle('is-selected', active);
    control.setAttribute('aria-pressed', String(active));
    control.setAttribute('aria-label', `${active ? 'Quitar de' : 'Agregar a'} mi selección`);
    control.textContent = '+';
    control.hidden = active;
  });

  document.querySelectorAll<HTMLElement>('[data-product-card]').forEach((card) => {
    const productId = card.dataset.productCard ?? '';
    const selection = card.querySelector<HTMLElement>('[data-product-selection]');
    const selectable = selection?.dataset.productSelectable !== 'false';
    card.classList.toggle('is-selected', selectable && byId.has(productId));
  });

  document.querySelectorAll<HTMLElement>('[data-product-selection]').forEach((container) => {
    const productId = container.dataset.productSelection ?? '';
    const item = byId.get(productId);
    const quantityControls = container.querySelector<HTMLElement>('[data-product-quantity-controls]');
    if (quantityControls) quantityControls.hidden = !item;
    const quantity = container.querySelector<HTMLElement>(`[data-product-quantity="${CSS.escape(productId)}"]`);
    if (quantity) quantity.textContent = String(item?.quantity ?? 1);
  });

  document.querySelectorAll<HTMLButtonElement>('[data-product-dialog] [data-dialog-select]').forEach((control) => {
    const dialog = control.closest<HTMLElement>('[data-product-dialog]');
    const active = byId.has(dialog?.dataset.productDialog ?? '');
    control.setAttribute('aria-pressed', String(active));
    control.textContent = active ? '✓ En mi selección' : 'Agregar a mi selección';
  });
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
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
    footer.innerHTML = items.length > 0 ? `
      <a class="lihen-button lihen-button--dark" href="${buildSelectionWhatsAppUrl(items)}" target="_blank" rel="noreferrer">Consultar ${items.length} referencia${items.length === 1 ? '' : 's'} por WhatsApp</a>
      <p class="selection-summary">${totalUnits} ${totalUnits === 1 ? 'unidad seleccionada' : 'unidades seleccionadas'}</p>
      <button type="button" class="selection-clear" data-selection-clear>Vaciar selección</button>
    ` : '';
    root.querySelectorAll<HTMLElement>('[data-selection-count]').forEach((counter) => { counter.textContent = String(items.length); });
    syncProductSelectionControls(items);

    body.querySelectorAll<HTMLButtonElement>('[data-selection-remove]').forEach((button) => {
      button.addEventListener('click', () => removeFromSelection(button.dataset.selectionRemove ?? ''));
    });
    body.querySelectorAll<HTMLButtonElement>('[data-selection-increment]').forEach((button) => {
      button.addEventListener('click', () => incrementSelectionQuantity(button.dataset.selectionIncrement ?? ''));
    });
    body.querySelectorAll<HTMLButtonElement>('[data-selection-decrement]').forEach((button) => {
      button.addEventListener('click', () => decrementSelectionQuantity(button.dataset.selectionDecrement ?? ''));
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
