import lihenLogoOfficial from '../assets/brand/lihen-logo-official.png';
import enterizosCover from '../assets/catalog/style/category-covers/style-enterizos-cover.png';
import faldaTopCover from '../assets/catalog/style/category-covers/style-falda-top-cover.png';
import shortsCover from '../assets/catalog/style/category-covers/style-shorts-cover.png';
import hombreCover from '../assets/catalog/style/category-covers/style-hombre-cover.png';
import type { StyleCategoryCoverKey } from '../composition/catalog-style-category-covers';

const COVER_ART: Partial<Record<StyleCategoryCoverKey, string>> = {
  ENTERIZOS: enterizosCover,
  FALDA_TOP: faldaTopCover,
  SHORTS: shortsCover,
  HOMBRE: hombreCover,
};

export function CatalogStyleCategoryCover({
  coverKey,
  label,
  heroImageUrl,
  heroImageAlt,
  pageNumber,
  totalPages,
}: {
  coverKey: StyleCategoryCoverKey;
  label: string;
  heroImageUrl: string;
  heroImageAlt: string;
  pageNumber: number;
  totalPages: number;
}) {
  const artwork = COVER_ART[coverKey];

  if (artwork) {
    return (
      <section
        className="catalog-sheet catalog-style-category-cover"
        data-style-category-cover={coverKey}
        aria-label={`Introducción de categoría ${label}`}
      >
        <img
          className="catalog-style-category-cover__art"
          src={artwork}
          alt={`LIHEN.CO Style · ${label}`}
          loading="eager"
        />
        <span className="catalog-style-category-cover__page-marker" aria-hidden="true">
          {pageNumber}/{totalPages}
        </span>
      </section>
    );
  }

  return (
    <section
      className="catalog-sheet catalog-style-category-cover catalog-style-category-cover--dynamic"
      data-style-category-cover="GENERIC"
      aria-label={`Introducción de categoría ${label}`}
    >
      <header className="catalog-style-category-cover__masthead">
        <div className="catalog-style-category-cover__collection">
          <span>COLECCIÓN</span>
          <strong>2026</strong>
        </div>
        <img
          className="catalog-style-category-cover__logo"
          src={lihenLogoOfficial}
          alt="Logo oficial LIHEN"
        />
        <div className="catalog-style-category-cover__line-label">LIHEN STYLE</div>
      </header>

      <div className="catalog-style-category-cover__hero">
        <img src={heroImageUrl} alt={heroImageAlt} loading="eager" />
      </div>

      <div className="catalog-style-category-cover__veil" aria-hidden="true" />

      <div className="catalog-style-category-cover__title-block">
        <h2>{label}</h2>
        <div className="catalog-style-category-cover__title-rule" />
      </div>

      <span className="catalog-style-category-cover__page-marker" aria-hidden="true">
        {pageNumber}/{totalPages}
      </span>
    </section>
  );
}
