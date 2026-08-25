import beautyFeatureUrl from '../assets/home/products/beauty-feature.webp';
import beautyDetailUrl from '../assets/home/products/beauty-detail.webp';
import bannerRepresentationUrl from '../assets/home/banners/que-te-representa.webp';
import bannerStyleUrl from '../assets/home/banners/estilo-que-te-impulsa.webp';
import bannerIdentityUrl from '../assets/home/banners/nube-identidad.webp';
import { buildCatalogHref } from './catalog-navigation';

export function renderHomePage(): string {
  return `
    <section class="home-hero" id="novedades" aria-label="Destacados LIHEN.CO">
      <div class="home-hero__viewport" data-home-hero>
        <article class="home-hero__slide home-hero__slide--editorial is-active" data-home-slide>
          <div class="home-hero__editorial-copy">
            <p class="lihen-eyebrow">LIHEN.CO · Beauty Care & Style</p>
            <h1 class="lihen-display">Detalles que acompañan tu esencia.</h1>
            <p>Productos seleccionados para cuidarte, expresarte y disfrutar cada momento con intención.</p>
            <div class="home-hero__actions">
              <a class="lihen-button lihen-button--dark" href="${buildCatalogHref({ businessLine: 'BEAUTY_CARE' })}">Explorar Beauty Care</a>
              <a class="lihen-button lihen-button--light" href="${buildCatalogHref({ businessLine: 'STYLE' })}">Ver Style</a>
            </div>
          </div>
          <div class="home-hero__editorial-media">
            <img src="${beautyFeatureUrl}" alt="Selección Beauty Care de LIHEN.CO" />
          </div>
        </article>

        <a class="home-hero__slide home-hero__slide--banner" data-home-slide href="${buildCatalogHref({ businessLine: 'BEAUTY_CARE' })}" aria-label="Descubrir Beauty Care y Style">
          <img src="${bannerRepresentationUrl}" alt="¿Qué te representa? Beauty y Style" />
        </a>
        <a class="home-hero__slide home-hero__slide--banner" data-home-slide href="${buildCatalogHref({ businessLine: 'STYLE' })}" aria-label="Explorar Style">
          <img src="${bannerStyleUrl}" alt="LIHEN.CO, estilo que te impulsa" />
        </a>
        <a class="home-hero__slide home-hero__slide--banner" data-home-slide href="#experiencia" aria-label="Conocer la identidad LIHEN.CO">
          <img src="${bannerIdentityUrl}" alt="Identidad visual LIHEN.CO" />
        </a>

        <button class="home-hero__arrow home-hero__arrow--prev" type="button" data-home-prev aria-label="Destacado anterior">‹</button>
        <button class="home-hero__arrow home-hero__arrow--next" type="button" data-home-next aria-label="Siguiente destacado">›</button>
        <div class="home-hero__dots" data-home-dots aria-label="Seleccionar destacado"></div>
      </div>
    </section>

    <section class="lihen-section home-categories" aria-labelledby="home-categories-title">
      <div class="home-section-heading lihen-shell">
        <p class="lihen-eyebrow">Descubre LIHEN</p>
        <h2 class="lihen-display" id="home-categories-title">Algo especial para cada momento.</h2>
      </div>
      <div class="home-category-grid lihen-shell">
        <a class="home-category home-category--rose" href="${buildCatalogHref({ businessLine: 'BEAUTY_CARE' })}">
          <span>Beauty Care</span><small>Maquillaje y cuidado</small>
        </a>
        <a class="home-category home-category--cream" href="${buildCatalogHref({ businessLine: 'BEAUTY_CARE' })}">
          <span>Cuidado</span><small>Rutinas para ti</small>
        </a>
        <a class="home-category home-category--lilac" href="${buildCatalogHref({ businessLine: 'STYLE' })}">
          <span>Style</span><small>Moda que te representa</small>
        </a>
        <a class="home-category home-category--gold" href="#marcas">
          <span>Marcas</span><small>Favoritas del catálogo</small>
        </a>
      </div>
    </section>

    <section class="lihen-section home-campaign" id="beauty" aria-labelledby="beauty-campaign-title">
      <div class="home-campaign__grid lihen-shell">
        <div class="home-campaign__collage">
          <figure class="home-campaign__main"><img src="${beautyFeatureUrl}" alt="Producto destacado Beauty Care" /></figure>
          <figure class="home-campaign__detail"><img src="${beautyDetailUrl}" alt="Detalle de selección Beauty Care" /></figure>
          <span class="home-campaign__badge">Beauty Care</span>
        </div>
        <div class="home-campaign__copy">
          <p class="lihen-eyebrow">Colección Beauty Care</p>
          <h2 class="lihen-display" id="beauty-campaign-title">Cuidado que realza tu belleza natural.</h2>
          <p>Maquillaje y cuidado personal seleccionados para acompañar tu rutina con practicidad, intención y estilo.</p>
          <div class="home-campaign__facts">
            <div><strong>952</strong><span>productos visibles en el storefront canónico</span></div>
            <div><strong>Beauty</strong><span>marcas y categorías organizadas desde una sola fuente</span></div>
          </div>
          <a class="lihen-button lihen-button--lilac" href="#marcas">Explorar marcas</a>
        </div>
      </div>
    </section>

    <section class="lihen-section home-brands" id="marcas" aria-labelledby="home-brands-title" data-home-brands>
      <div class="home-brands__heading lihen-shell">
        <div>
          <p class="lihen-eyebrow">Explora el catálogo</p>
          <h2 class="lihen-display" id="home-brands-title">Compra por marcas.</h2>
          <p>Marcas y conteos obtenidos desde la proyección canónica de productos publicados.</p>
        </div>
        <div class="home-brands__controls" aria-label="Mover carrusel de marcas">
          <button type="button" data-brand-prev aria-label="Ver marcas anteriores">‹</button>
          <button type="button" data-brand-next aria-label="Ver más marcas">›</button>
        </div>
      </div>
      <div class="home-brands__toolbar lihen-shell" aria-label="Selector de marcas por colección">
        <button type="button" class="is-active" data-brand-line="BEAUTY_CARE" aria-pressed="true">Beauty Care</button>
        <button type="button" data-brand-line="STYLE" aria-pressed="false">Style</button>
      </div>
      <div class="home-brands__viewport lihen-shell" data-brand-viewport tabindex="0" aria-label="Marcas disponibles">
        <div class="home-brands__track" data-brand-track></div>
      </div>
      <p class="home-brands__status lihen-shell" data-brand-status role="status">Cargando marcas Beauty Care…</p>
      <p class="home-brands__note lihen-shell">Selecciona una marca para ver sus referencias publicadas en el catálogo.</p>
    </section>

    <section class="product-rail lihen-shell" data-product-rail="discover" aria-label="Productos destacados"><p class="product-rail__error">Cargando selección LIHEN…</p></section>

    <section class="product-rail lihen-shell" data-product-rail="bloomshell" aria-label="Productos Bloomshell"><p class="product-rail__error">Cargando productos por marca…</p></section>

    <section class="lihen-section home-style" id="style" aria-labelledby="style-title">
      <div class="home-style__card lihen-shell">
        <div class="home-style__copy">
          <p class="lihen-eyebrow">LIHEN Style</p>
          <h2 class="lihen-display" id="style-title">Estilo que se mueve contigo.</h2>
          <p>La línea Style conserva su espacio editorial en la experiencia LIHEN. Sus productos se incorporarán al storefront únicamente cuando formen parte de la proyección canónica publicada.</p>
          <a class="lihen-button lihen-button--light" href="${buildCatalogHref({ businessLine: 'STYLE' })}">Ver colección Style</a>
        </div>
        <div class="home-style__media"><img src="${bannerStyleUrl}" alt="LIHEN.CO Style, estilo que te impulsa" /></div>
      </div>
    </section>

    <section class="lihen-section home-experience" id="experiencia" aria-labelledby="experience-title">
      <div class="home-experience__grid lihen-shell">
        <div>
          <p class="lihen-eyebrow">Así se vive LIHEN.CO</p>
          <h2 class="lihen-display" id="experience-title">Belleza, estilo y atención cercana.</h2>
        </div>
        <div class="home-experience__cards">
          <article><span>01</span><h3>Selección con intención</h3><p>Un catálogo organizado para encontrar opciones reales, claras y disponibles.</p></article>
          <article><span>02</span><h3>Atención personalizada</h3><p>Acompañamiento antes de comprar para confirmar producto, disponibilidad y entrega.</p></article>
          <article><span>03</span><h3>Una sola verdad</h3><p>La web ya se construye sobre la misma información canónica que controla LIHEN Platform.</p></article>
        </div>
      </div>
    </section>

    <span id="accesorios" hidden></span>
  `;
}

export function bindHomePageInteractions(root: HTMLElement): void {
  const hero = root.querySelector<HTMLElement>('[data-home-hero]');
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-home-slide]'));
  const dotsRoot = root.querySelector<HTMLElement>('[data-home-dots]');
  const prev = root.querySelector<HTMLButtonElement>('[data-home-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-home-next]');

  if (hero && slides.length > 0 && dotsRoot && prev && next) {
    let current = 0;
    let timer: number | undefined;

    let dots: HTMLButtonElement[] = [];

    const show = (index: number, restart = false): void => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => slide.classList.toggle('is-active', slideIndex === current));
      hero.classList.toggle('is-banner-active', slides[current]?.classList.contains('home-hero__slide--banner') ?? false);
      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle('is-active', dotIndex === current);
        dot.setAttribute('aria-current', dotIndex === current ? 'true' : 'false');
      });
      if (restart) start();
    };

    const start = (): void => {
      window.clearInterval(timer);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      timer = window.setInterval(() => show(current + 1), 6500);
    };

    dots = slides.map((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Ir al destacado ${index + 1}`);
      dot.addEventListener('click', () => show(index, true));
      dotsRoot.append(dot);
      return dot;
    });

    prev.addEventListener('click', () => show(current - 1, true));
    next.addEventListener('click', () => show(current + 1, true));
    hero.addEventListener('mouseenter', () => window.clearInterval(timer));
    hero.addEventListener('mouseleave', start);
    hero.addEventListener('focusin', () => window.clearInterval(timer));
    hero.addEventListener('focusout', start);

    show(0);
    start();
  }

}
