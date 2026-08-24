import lihenLogoUrl from '../assets/brand/lihen-logo-official.png';

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

export function renderSiteShell(): string {
  return `
    <a class="skip-link" href="#contenido">Saltar al contenido</a>
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
          <button class="icon-button" type="button" aria-label="Mi selección" disabled title="Disponible en FASE 5.9">${selectionIcon}</button>
          <button class="icon-button menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Abrir menú">
            <span aria-hidden="true">☰</span>
          </button>
        </div>
      </div>
      <nav class="main-nav lihen-shell" id="main-nav" aria-label="Navegación principal">
        <a href="#novedades">Novedades</a>
        <a href="#beauty">Belleza</a>
        <a href="#style">Moda</a>
        <a href="#accesorios">Accesorios</a>
        <a href="#experiencia">Así se vive LIHEN.CO</a>
        <a href="#regalos">Ideas para regalar</a>
        <a href="#nosotros">Nosotros</a>
      </nav>
    </header>

    <main id="contenido">
      <section class="shell-hero" id="novedades" aria-labelledby="hero-title">
        <div class="shell-hero__grid">
          <div class="shell-hero__copy">
            <p class="lihen-eyebrow">LIHEN.CO · Beauty Care & Style</p>
            <h1 class="lihen-display" id="hero-title">Detalles que acompañan tu esencia.</h1>
            <p>Una nueva base para la experiencia LIHEN: el mismo lenguaje visual que ya conoces, conectado a una sola verdad canónica.</p>
            <div class="shell-hero__actions">
              <a class="lihen-button lihen-button--dark" href="#beauty">Explorar Beauty Care</a>
              <a class="lihen-button lihen-button--light" href="#style">Ver Style</a>
            </div>
          </div>
          <div class="shell-hero__visual" aria-hidden="true">
            <div class="shell-hero__seal"><img src="${lihenLogoUrl}" alt="" /></div>
          </div>
        </div>
      </section>

      <section class="lihen-section shell-foundation" id="beauty">
        <div class="lihen-shell">
          <div class="shell-foundation__heading">
            <p class="lihen-eyebrow">FASE 5.3 · Sistema visual</p>
            <h2 class="lihen-display">La identidad de LIHEN, convertida en una base reusable.</h2>
            <p class="lihen-muted">Tipografía editorial, tonos crema y nude, lila, dorado, superficies suaves y responsive consistente. Los productos reales entran en los siguientes bloques sin volver a duplicar datos.</p>
          </div>
          <div class="foundation-grid">
            <article class="lihen-card foundation-card">
              <div class="foundation-card__swatch"></div>
              <h3>Beauty Care</h3>
              <p>Jerarquía femenina y editorial para maquillaje, cuidado facial, corporal y capilar.</p>
            </article>
            <article class="lihen-card foundation-card" id="style">
              <div class="foundation-card__swatch"></div>
              <h3>Style</h3>
              <p>La misma identidad LIHEN aplicada a moda casual, deportiva, mujer, hombre y accesorios.</p>
            </article>
            <article class="lihen-card foundation-card" id="accesorios">
              <div class="foundation-card__swatch"></div>
              <h3>Una sola experiencia</h3>
              <p>Componentes compartidos, estados accesibles y una arquitectura independiente de la fuente legacy.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="lihen-section shell-next" id="experiencia">
        <div class="lihen-shell">
          <div class="lihen-card shell-next__card">
            <div class="shell-next__copy">
              <p class="lihen-eyebrow">Siguiente integración</p>
              <h2 class="lihen-display">El shell ya está listo para recibir navegación y catálogo canónico.</h2>
              <p class="lihen-muted">FASE 5.4 conectará header, mega menú y taxonomía; después entrarán home, marcas, tarjetas, carruseles, búsqueda y ficha de producto.</p>
            </div>
            <div class="shell-next__badge">952 productos listos</div>
          </div>
        </div>
      </section>

      <span id="regalos" hidden></span>
      <span id="nosotros" hidden></span>
    </main>

    <footer class="site-footer">
      <div class="site-footer__inner lihen-shell">
        <div class="site-footer__brand">
          <img src="${lihenLogoUrl}" alt="LIHEN.CO" />
          <span>Beauty Cure | Style</span>
        </div>
        <span>FASE 5 · Storefront canónico</span>
      </div>
    </footer>
  `;
}

export function bindSiteShellInteractions(root: HTMLElement): void {
  const toggle = root.querySelector<HTMLButtonElement>('.menu-toggle');
  const nav = root.querySelector<HTMLElement>('#main-nav');
  if (!toggle || !nav) return;

  const closeMenu = (): void => {
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  };

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    nav.classList.toggle('is-open', !isOpen);
  });

  nav.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeMenu();
  });
}
