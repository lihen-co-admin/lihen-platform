import lihenLogoUrl from '../assets/brand/lihen-logo-official.png';
import { bindSiteHeaderInteractions, renderSiteHeader } from './site-header';

export function renderSiteShell(): string {
  return `
    <a class="skip-link" href="#contenido">Saltar al contenido</a>
    ${renderSiteHeader()}

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
  bindSiteHeaderInteractions(root);
}
