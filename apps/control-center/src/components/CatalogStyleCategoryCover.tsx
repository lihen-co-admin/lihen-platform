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
  pageNumber,
  totalPages,
}: {
  coverKey: StyleCategoryCoverKey;
  label: string;
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
    <section className="catalog-sheet catalog-style-category catalog-style-editorial">
      <div className="catalog-style-category__index">LIHEN.CO STYLE</div>
      <div className="catalog-style-category__rule" />
      <h2>{label}</h2>
      <p>Una pausa editorial para descubrir la siguiente selección.</p>
      <footer className="catalog-style-footer">
        <span>LIHEN.CO · STYLE</span>
        <span>PÁGINA {pageNumber} DE {totalPages}</span>
      </footer>
    </section>
  );
}
