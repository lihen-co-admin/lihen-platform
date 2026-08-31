import type { CatalogRenderEntry } from '../composition/catalogs';
import {
  STYLE_FACE_POLICY_MODE,
  STYLE_TEMPLATE_LABELS,
  getStyleCtaLabel,
  getStyleMicrocopy,
} from '../composition/catalog-style-templates';
import type { StyleEditorialTemplate } from '../composition/catalog-style-visual';
import type { StyleCategoryCoverKey } from '../composition/catalog-style-category-covers';
import { CatalogStyleCategoryCover } from './CatalogStyleCategoryCover';

type StyleProductSheetProps = {
  entry: CatalogRenderEntry;
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

function WhatsappMiniMark() {
  return (
    <span className="catalog-style-wa-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M12 3.4a8.4 8.4 0 0 0-7.2 12.7L3.7 20.5l4.5-1.1A8.4 8.4 0 1 0 12 3.4Zm0 1.7a6.7 6.7 0 1 1-3.5 12.4l-.3-.2-2.1.5.5-2-.2-.3A6.7 6.7 0 0 1 12 5.1Z" />
      </svg>
    </span>
  );
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
  const sku = entry.sku || entry.productCatalogCode || entry.businessLine;
  const microcopy = getStyleMicrocopy(entry);
  const cta = getStyleCtaLabel(entry);

  return (
    <section
      className={`catalog-sheet catalog-style-product catalog-style-template catalog-style-template--${template.toLowerCase()}`}
      data-template={template}
    >
      <div
        className="catalog-style-product__photo catalog-style-editorial__photo"
        data-face-policy={STYLE_FACE_POLICY_MODE}
      >
        <img
          src={entry.imageUrl}
          alt={entry.imageAlt || entry.productName}
          loading="eager"
          onLoad={onImageReady}
          onError={onImageError}
        />
        {template === 'C' ? <div className="catalog-style-product__arch" aria-hidden="true" /> : null}
      </div>

      <div className="catalog-style-product__content catalog-style-editorial__panel">
        <p className="catalog-style-editorial__eyebrow">
          COLECCIÓN 2026 · {STYLE_TEMPLATE_LABELS[template]}
        </p>
        <div className="catalog-style-editorial__rule" />
        <p className="catalog-style-product__ref">REF. {sku}</p>
        <h2 className="catalog-style-editorial__title">{entry.productName}</h2>
        <p className="catalog-style-product__microcopy">{microcopy}</p>
        <div className="catalog-style-product__purchase">
          <strong>{formatPrice(entry.salePrice)}</strong>
          <a href={whatsappUrl}>
            <WhatsappMiniMark />
            <span>{cta}</span>
          </a>
        </div>
      </div>

      <div className="catalog-style-product__signature">LIHEN.CO STYLE</div>

      <footer className="catalog-style-footer">
        <span>LIHEN.CO · STYLE</span>
        <span>PÁGINA {pageNumber} DE {totalPages}</span>
      </footer>
    </section>
  );
}
