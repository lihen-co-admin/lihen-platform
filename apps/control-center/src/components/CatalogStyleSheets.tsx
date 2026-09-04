import lihenLogoOfficial from '../assets/brand/lihen-logo-official.png';
import type { CatalogRenderProductSnapshot } from '@lihen/catalog';
import {
  STYLE_FACE_POLICY_MODE,
  getStyleCtaLabel,
} from '../composition/catalog-style-templates';
import type { StyleEditorialTemplate } from '../composition/catalog-style-visual';
import type { StyleCategoryCoverKey } from '../composition/catalog-style-category-covers';
import { CatalogStyleCategoryCover } from './CatalogStyleCategoryCover';
import {
  STYLE_PRODUCT_VISUAL_CONTRACT,
  getStyleProductImagePreparation,
  getStyleProductReference,
} from '../composition/catalog-style-product-visual';

type StyleProductSheetProps = {
  entry: CatalogRenderProductSnapshot;
  template: StyleEditorialTemplate;
  pageNumber: number;
  totalPages: number;
  whatsappUrl: string;
  onImageReady: () => void;
  onImageError: () => void;
};

function formatPrice(value: number): string {
  return value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}


export function StyleCategorySheet({
  label,
  coverKey,
  pageNumber,
  totalPages,
}: {
  label: string;
  coverKey: StyleCategoryCoverKey;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <CatalogStyleCategoryCover
      coverKey={coverKey}
      label={label}
      pageNumber={pageNumber}
      totalPages={totalPages}
    />
  );
}

export function StyleProductSheet({
  entry,
  template,
  pageNumber,
  totalPages,
  whatsappUrl,
  onImageReady,
  onImageError,
}: StyleProductSheetProps) {
  const reference = getStyleProductReference(entry);
  const cta = getStyleCtaLabel(entry);
  const preparedImage = getStyleProductImagePreparation(entry);

  return (
    <section
      className="catalog-sheet catalog-style-product catalog-style-product--approved"
      data-template={template}
      data-product-visual-contract="CUT8_APPROVED"
      data-price-policy={STYLE_PRODUCT_VISUAL_CONTRACT.pricePolicy.visiblePrice}
    >
      <header className="catalog-style-product__masthead">
        <div className="catalog-style-product__collection">
          <span>COLECCIÓN</span>
          <strong>2026</strong>
        </div>
        <div className="catalog-style-product__brand">
          <img src={lihenLogoOfficial} alt="Logo oficial LIHEN" />
          <span>LIHEN.CO STYLE</span>
        </div>
        <div className="catalog-style-product__line-label">LIHEN.CO STYLE</div>
      </header>

      <div
        className="catalog-style-product__photo catalog-style-editorial__photo"
        data-face-policy={STYLE_FACE_POLICY_MODE}
        data-image-preparation={preparedImage.mode}
        data-editorial-asset-role={preparedImage.editorialRole}
        data-canonical-asset-authority={preparedImage.canonicalAuthority ? 'true' : 'false'}
      >
        <img
          src={preparedImage.sourceUrl}
          alt={preparedImage.alt}
          loading="eager"
          onLoad={onImageReady}
          onError={onImageError}
        />
      </div>

      <div className="catalog-style-product__content catalog-style-editorial__panel">
        <p className="catalog-style-product__ref">REF. {reference}</p>
        <h2 className="catalog-style-editorial__title">{entry.productName}</h2>
        <div className="catalog-style-editorial__rule" />
      </div>

      <div className="catalog-style-product__price-card">
        <div className="catalog-style-product__price-icon" aria-hidden="true">+</div>
        <div>
          <span>{STYLE_PRODUCT_VISUAL_CONTRACT.pricePolicy.label}</span>
          <strong>{formatPrice(entry.salePriceSnapshot)}</strong>
        </div>
      </div>

      <a className="catalog-style-product__cta" href={whatsappUrl}>
        <span className="catalog-style-product__cta-arrow" aria-hidden="true">↘</span>
        <span>{cta}</span>
      </a>

      <div className="catalog-style-product__wave catalog-style-product__wave--left" aria-hidden="true" />
      <div className="catalog-style-product__wave catalog-style-product__wave--right" aria-hidden="true" />

      <footer className="catalog-style-footer">
        <span>LIHEN.CO · STYLE</span>
        <span>PÁGINA {pageNumber} DE {totalPages}</span>
      </footer>
    </section>
  );
}
