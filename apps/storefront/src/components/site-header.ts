import lihenLogoUrl from '../assets/brand/lihen-logo-official.png';
import { storefrontNavigation, type MegaNavigationItem } from './storefront-navigation';

const searchIcon = `
<svg viewBox="0 0 32 32" aria-hidden="true">
  <circle cx="14" cy="14" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
  <path d="m19.5 19.5 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

const selectionIcon = `
<svg viewBox="0 0 32 32" aria-hidden="true">
  <path d="M7.5 11h17l1.3 17H6.2l1.3-17Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
  <path d="M11.5 12V9a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
</svg>`;

const chevronIcon = `
<svg viewBox="0 0 16 16" aria-hidden="true">
  <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function renderNavigationItem(item: (typeof storefrontNavigation)[number]): string {
  if (item.kind === 'direct') {
    return `<a class="nav-direct" href="${item.href}">${item.label}</a>`;
  }

  return `
    <div class="nav-mega-item" data-nav-item="${item.key}">
      <button
        class="nav-mega-trigger"
        type="button"
        aria-expanded="false"
        aria-controls="mega-${item.key}"
        data-mega-trigger="${item.key}"
      >
        <span>${item.label}</span>
        <span class="nav-mega-trigger__chevron">${chevronIcon}</span>
      </button>
      ${renderMegaPanel(item)}
    </div>
  `;
}

function renderMegaGroup(group: MegaNavigationItem['groups'][number]): string {
  return `
    <section class="mega-group">
      <h3>${group.title}</h3>
      <div class="mega-group__links">
        ${group.links.map((link) => `
          <a href="${link.href}" data-mega-link>
            <span>${link.label}</span>
            ${link.meta ? `<small>${link.meta}</small>` : ''}
          </a>
        `).join('')}
      </div>
    </section>
  `;
}

function renderMegaPanel(item: MegaNavigationItem): string {
  return `
    <section
      class="mega-panel mega-panel--${item.accent}"
      id="mega-${item.key}"
      data-mega-panel="${item.key}"
      aria-label="${item.label}"
      hidden
    >
      <div class="mega-panel__inner lihen-shell">
        <div class="mega-panel__intro">
          <p class="lihen-eyebrow">${item.eyebrow}</p>
          <h2>${item.title}</h2>
          <p>${item.description}</p>
          <a class="mega-panel__primary" href="${item.href}" data-mega-link>Explorar ${item.label}</a>
        </div>
        <div class="mega-panel__groups">
          ${item.groups.map(renderMegaGroup).join('')}
        </div>
        <div class="mega-panel__feature" aria-hidden="true">
          <span>LIHEN.CO</span>
          <strong>Beauty Care<br>& Style</strong>
          <div class="mega-panel__orb"></div>
        </div>
      </div>
    </section>
  `;
}

export function renderSiteHeader(): string {
  return `
    <div class="announcement">Envíos a toda Colombia · Atención personalizada · LIHEN.CO</div>
    <header class="site-header" id="inicio">
      <div class="header-main lihen-shell">
        <div class="header-slot header-slot--start">
          <button class="icon-button" type="button" aria-label="Buscar productos" disabled title="Disponible en FASE 5.7">${searchIcon}</button>
        </div>
        <a class="brand" href="#inicio" aria-label="Inicio LIHEN.CO">
          <img src="${lihenLogoUrl}" alt="LIHEN.CO" />
        </a>
        <div class="header-slot header-slot--end">
          <button class="icon-button selection-button" type="button" aria-label="Mi selección" disabled title="Disponible en FASE 5.9">
            ${selectionIcon}
            <small aria-hidden="true">0</small>
          </button>
          <button class="icon-button menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Abrir menú">
            <span class="menu-toggle__icon" aria-hidden="true"><i></i><i></i><i></i></span>
          </button>
        </div>
      </div>

      <nav class="main-nav lihen-shell" id="main-nav" aria-label="Navegación principal">
        ${storefrontNavigation.map(renderNavigationItem).join('')}
      </nav>

    </header>
  `;
}

export function bindSiteHeaderInteractions(root: HTMLElement): void {
  const header = root.querySelector<HTMLElement>('.site-header');
  const menuToggle = root.querySelector<HTMLButtonElement>('.menu-toggle');
  const nav = root.querySelector<HTMLElement>('#main-nav');
  const triggers = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mega-trigger]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-mega-panel]'));

  if (!header || !menuToggle || !nav) return;

  let activeKey: string | null = null;
  let closeTimer: number | undefined;

  const isDesktop = (): boolean => window.matchMedia('(min-width: 901px)').matches;

  const setMenuOpen = (open: boolean): void => {
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open && !isDesktop());
  };

  const closeMega = (): void => {
    activeKey = null;
    triggers.forEach((trigger) => {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.closest('.nav-mega-item')?.classList.remove('is-active');
    });
    panels.forEach((panel) => {
      panel.hidden = true;
      panel.classList.remove('is-open');
    });
  };

  const openMega = (key: string): void => {
    window.clearTimeout(closeTimer);
    activeKey = key;

    triggers.forEach((trigger) => {
      const matches = trigger.dataset.megaTrigger === key;
      trigger.setAttribute('aria-expanded', String(matches));
      trigger.closest('.nav-mega-item')?.classList.toggle('is-active', matches);
    });

    panels.forEach((panel) => {
      const matches = panel.dataset.megaPanel === key;
      panel.hidden = !matches;
      panel.classList.toggle('is-open', matches);
    });
  };

  const scheduleMegaClose = (): void => {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(closeMega, 160);
  };

  menuToggle.addEventListener('click', () => {
    setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
  });

  triggers.forEach((trigger) => {
    const key = trigger.dataset.megaTrigger;
    if (!key) return;

    trigger.addEventListener('mouseenter', () => {
      if (isDesktop()) openMega(key);
    });

    trigger.addEventListener('focus', () => {
      if (isDesktop()) openMega(key);
    });

    trigger.addEventListener('click', () => {
      if (activeKey === key) closeMega();
      else openMega(key);
    });
  });

  header.addEventListener('mouseenter', () => window.clearTimeout(closeTimer));
  header.addEventListener('mouseleave', () => {
    if (isDesktop()) scheduleMegaClose();
  });

  root.querySelectorAll<HTMLAnchorElement>('.main-nav a, [data-mega-link]').forEach((link) => {
    link.addEventListener('click', () => {
      closeMega();
      if (!isDesktop()) setMenuOpen(false);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeMega();
    setMenuOpen(false);
    menuToggle.focus();
  });

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Node) || header.contains(event.target)) return;
    closeMega();
    if (!isDesktop()) setMenuOpen(false);
  });

  window.addEventListener('resize', () => {
    closeMega();
    if (isDesktop()) setMenuOpen(false);
  });
}
