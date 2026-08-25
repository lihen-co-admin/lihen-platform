import { buildCatalogHref, type CatalogBusinessLine } from './catalog-navigation';
import { bundledBrandLogoFallbacks } from './brand-logo-assets';
import { getStorefrontBrands } from './storefront-api';
import type { StorefrontBrand } from './storefront-brand';
import { escapeHtml } from './storefront-product';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function renderBrand(brand: StorefrontBrand, businessLine: CatalogBusinessLine): string {
  const name = escapeHtml(brand.brand_name);
  const canonicalOrFallbackLogo = brand.logo_url ?? bundledBrandLogoFallbacks[brand.brand_name] ?? null;
  const logo = canonicalOrFallbackLogo
    ? `<img src="${escapeHtml(canonicalOrFallbackLogo)}" alt="${name}" loading="lazy" decoding="async" />`
    : `<span class="home-brand__initials" aria-hidden="true">${escapeHtml(initials(brand.brand_name))}</span>`;
  const countLabel = brand.visible_product_count === 1 ? '1 referencia' : `${brand.visible_product_count} referencias`;

  return `
    <a class="home-brand" href="${buildCatalogHref({ businessLine, brand: brand.brand_name })}" aria-label="Ver ${countLabel} de ${name}">
      <div class="home-brand__logo">${logo}</div>
      <strong>${name}</strong>
      <span>${countLabel}</span>
    </a>
  `;
}

export async function hydrateHomeBrands(root: HTMLElement): Promise<void> {
  const section = root.querySelector<HTMLElement>('[data-home-brands]');
  const viewport = root.querySelector<HTMLElement>('[data-brand-viewport]');
  const track = root.querySelector<HTMLElement>('[data-brand-track]');
  const status = root.querySelector<HTMLElement>('[data-brand-status]');
  const prev = root.querySelector<HTMLButtonElement>('[data-brand-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-brand-next]');
  const lineButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-brand-line]'));
  if (!section || !viewport || !track || !status || !prev || !next || lineButtons.length === 0) return;

  let activeLine: CatalogBusinessLine = 'BEAUTY_CARE';
  let timer: number | undefined;

  const stopAuto = (): void => window.clearInterval(timer);
  const step = (): number => Math.max(190, viewport.clientWidth * 0.74);
  const canAutoScroll = (): boolean => track.scrollWidth > viewport.clientWidth + 4;

  const startAuto = (): void => {
    stopAuto();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !canAutoScroll()) return;
    timer = window.setInterval(() => {
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const nextLeft = viewport.scrollLeft + step();
      viewport.scrollTo({ left: nextLeft >= maxScroll - 8 ? 0 : nextLeft, behavior: 'smooth' });
    }, 4800);
  };

  const setPressed = (): void => {
    lineButtons.forEach((button) => {
      const isActive = button.dataset.brandLine === activeLine;
      button.setAttribute('aria-pressed', String(isActive));
      button.classList.toggle('is-active', isActive);
    });
  };

  const load = async (businessLine: CatalogBusinessLine): Promise<void> => {
    activeLine = businessLine;
    setPressed();
    stopAuto();
    viewport.scrollTo({ left: 0, behavior: 'auto' });
    track.innerHTML = '';
    status.hidden = false;
    status.textContent = businessLine === 'STYLE' ? 'Cargando marcas Style…' : 'Cargando marcas Beauty Care…';

    try {
      const brands = await getStorefrontBrands(businessLine);
      if (brands.length === 0) {
        status.textContent = businessLine === 'STYLE'
          ? 'Aún no hay marcas Style con productos publicados. Este espacio se activará automáticamente cuando Style complete su readiness.'
          : 'Aún no hay marcas publicadas para esta línea.';
        return;
      }
      track.innerHTML = brands.map((brand) => renderBrand(brand, businessLine)).join('');
      status.hidden = true;
      requestAnimationFrame(startAuto);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'No fue posible cargar las marcas.';
    }
  };

  prev.addEventListener('click', () => {
    stopAuto();
    viewport.scrollBy({ left: -step(), behavior: 'smooth' });
    startAuto();
  });
  next.addEventListener('click', () => {
    stopAuto();
    viewport.scrollBy({ left: step(), behavior: 'smooth' });
    startAuto();
  });
  viewport.addEventListener('mouseenter', stopAuto);
  viewport.addEventListener('mouseleave', startAuto);
  viewport.addEventListener('focusin', stopAuto);
  viewport.addEventListener('focusout', startAuto);
  lineButtons.forEach((button) => button.addEventListener('click', () => {
    const line = button.dataset.brandLine;
    if (line === 'BEAUTY_CARE' || line === 'STYLE') void load(line);
  }));

  await load(activeLine);
}
