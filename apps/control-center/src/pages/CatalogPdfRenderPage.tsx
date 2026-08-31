import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  catalogsComposition,
  type CatalogRenderEntry,
} from '../composition/catalogs';
import {
  catalogInstitutionalComposition,
  type CatalogInstitutionalContent,
  type InstitutionalPaymentMethod,
} from '../composition/catalog-institutional';
import lihenLogoOfficial from '../assets/brand/lihen-logo-official.png';
import catalogCoverPageOne from '../assets/catalog/catalog-cover-page-1.png';
import '../styles/catalog-pdf-print.css';

const PRODUCTS_PER_PAGE = 6;
const LEGACY_WHATSAPP_URL = 'https://wa.me/message/2JDWBH57SQG4F1';

type CatalogPdfLine = 'ALL' | 'BEAUTY_CARE' | 'STYLE';

function resolveCatalogPdfLine(value: string | null): CatalogPdfLine {
  if (value === 'BEAUTY_CARE' || value === 'STYLE') return value;
  return 'ALL';
}

function getCatalogPdfLineLabel(line: CatalogPdfLine): string {
  if (line === 'BEAUTY_CARE') return 'BEAUTY CARE';
  if (line === 'STYLE') return 'STYLE';
  return 'BEAUTY CARE | STYLE';
}

function filterCatalogEntriesByLine(
  entries: readonly CatalogRenderEntry[],
  line: CatalogPdfLine,
): readonly CatalogRenderEntry[] {
  if (line === 'ALL') return entries;
  return entries.filter((entry) => entry.businessLine === line);
}

type CatalogProductPage = {
  type: 'products';
  brand: string;
  entries: readonly CatalogRenderEntry[];
};

type CatalogBrandPage = {
  type: 'brand';
  brand: string;
};

type CatalogBodyPage = CatalogProductPage | CatalogBrandPage;

type QrDescriptor = {
  key: string;
  label: string;
  value: string;
  sourceType?: InstitutionalPaymentMethod['qrSourceType'];
};

function normalizeBrand(entry: CatalogRenderEntry): string {
  return entry.brand?.trim() || 'LIHEN';
}

function buildBodyPages(entries: readonly CatalogRenderEntry[]): readonly CatalogBodyPage[] {
  const result: CatalogBodyPage[] = [];
  let index = 0;

  while (index < entries.length) {
    const current = entries[index];
    if (!current) break;

    const brand = normalizeBrand(current);
    const segment: CatalogRenderEntry[] = [];

    while (index < entries.length) {
      const candidate = entries[index];
      if (!candidate || normalizeBrand(candidate) !== brand) break;
      segment.push(candidate);
      index += 1;
    }

    result.push({ type: 'brand', brand });

    for (let offset = 0; offset < segment.length; offset += PRODUCTS_PER_PAGE) {
      result.push({
        type: 'products',
        brand,
        entries: segment.slice(offset, offset + PRODUCTS_PER_PAGE),
      });
    }
  }

  return result;
}

function formatPrice(value: number): string {
  return value.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function WhatsAppMark() {
  return (
    <span className="catalog-wa-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M12 3.4a8.4 8.4 0 0 0-7.2 12.7L3.7 20.5l4.5-1.1A8.4 8.4 0 1 0 12 3.4Zm0 1.7a6.7 6.7 0 1 1-3.5 12.4l-.3-.2-2.1.5.5-2-.2-.3A6.7 6.7 0 0 1 12 5.1Zm-3 3.1c-.2 0-.4.1-.6.3-.2.2-.7.7-.7 1.7 0 1 .7 2 1 2.4.3.4 1.4 2.2 3.5 3 .5.2.9.4 1.2.5.5.2 1 .2 1.4.1.4-.1 1.3-.5 1.5-1.1.2-.6.2-1 .1-1.1-.1-.1-.2-.2-.5-.3l-1.4-.7c-.2-.1-.4-.1-.6.2l-.6.8c-.1.2-.3.2-.5.1-.3-.1-1-.4-1.8-1.1-.7-.6-1.1-1.3-1.3-1.5-.1-.2 0-.4.1-.5l.4-.5.2-.4c.1-.1 0-.3 0-.4l-.6-1.5c-.2-.4-.4-.4-.6-.4H9Z" />
      </svg>
    </span>
  );
}

function QrImage({
  descriptor,
  onReady,
  onError,
}: {
  descriptor: QrDescriptor;
  onReady: () => void;
  onError: () => void;
}) {
  const [src, setSrc] = useState('');
  const reported = useRef(false);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  useEffect(() => {
    let active = true;
    reported.current = false;
    setSrc('');

    if (descriptor.sourceType === 'IMAGE') {
      setSrc(descriptor.value);
      return () => {
        active = false;
      };
    }

    catalogInstitutionalComposition
      .generateQrSvg(descriptor.value, 320)
      .then((svg) => {
        if (active) {
          setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        }
      })
      .catch(() => {
        if (active && !reported.current) {
          reported.current = true;
          onErrorRef.current();
        }
      });

    return () => {
      active = false;
    };
  }, [descriptor.sourceType, descriptor.value]);

  if (!src) {
    return <div className="catalog-qr-loading">QR</div>;
  }

  return (
    <img
      className="catalog-institutional-qr"
      src={src}
      alt={`QR ${descriptor.label}`}
      onLoad={() => {
        if (!reported.current) {
          reported.current = true;
          onReadyRef.current();
        }
      }}
      onError={() => {
        if (!reported.current) {
          reported.current = true;
          onErrorRef.current();
        }
      }}
    />
  );
}

function buildChannelQrs(content: CatalogInstitutionalContent): readonly QrDescriptor[] {
  return [
    { key: 'storefront', label: 'TIENDA VIRTUAL', value: content.channels.storefrontUrl },
    { key: 'whatsapp', label: 'COMPRAR / CONSULTAR', value: content.channels.whatsappUrl },
    { key: 'instagram', label: 'INSTAGRAM', value: content.channels.instagramUrl },
    { key: 'tiktok', label: 'TIKTOK', value: content.channels.tiktokUrl },
    { key: 'facebook', label: 'FACEBOOK', value: content.channels.facebookUrl },
    {
      key: 'community',
      label: 'COMUNIDAD WHATSAPP',
      value: content.channels.whatsappCommunityUrl,
    },
  ].filter((item) => item.value.trim());
}

export function CatalogPdfRenderPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const pdfLine = resolveCatalogPdfLine(searchParams.get('line'));
  const [entries, setEntries] = useState<readonly CatalogRenderEntry[]>([]);
  const [institutional, setInstitutional] = useState<CatalogInstitutionalContent | null>(null);
  const [loadedImages, setLoadedImages] = useState(0);
  const [failedImages, setFailedImages] = useState(0);
  const [loadedExtras, setLoadedExtras] = useState(0);
  const [failedExtras, setFailedExtras] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      catalogsComposition.getRenderEntries(id),
      catalogInstitutionalComposition.getSnapshot(id),
    ])
      .then(([renderEntries, institutionalSnapshot]) => {
        if (!active) return;
        setEntries(renderEntries);
        setInstitutional(institutionalSnapshot);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'No fue posible cargar el snapshot para el renderer.',
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const renderEntries = useMemo(
    () => filterCatalogEntriesByLine(entries, pdfLine),
    [entries, pdfLine],
  );
  const pdfLineLabel = getCatalogPdfLineLabel(pdfLine);
  const bodyPages = useMemo(() => buildBodyPages(renderEntries), [renderEntries]);
  const first = renderEntries[0] ?? null;
  const paymentMethods = useMemo(
    () =>
      institutional
        ? [...institutional.paymentMethods]
            .filter((item) => item.enabled && item.qrValue.trim())
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [institutional],
  );
  const channelQrs = useMemo(
    () => (institutional ? buildChannelQrs(institutional) : []),
    [institutional],
  );
  const purchaseQrs = useMemo(
    () =>
      channelQrs.filter(
        (item) => item.key === 'storefront' || item.key === 'whatsapp',
      ),
    [channelQrs],
  );

  const processedImages = loadedImages + failedImages;
  const imageExtraExpected = institutional?.aboutImageUrl ? 1 : 0;
  const qrExpected = institutional
    ? purchaseQrs.length + paymentMethods.length + channelQrs.length
    : 0;
  const extrasExpected = imageExtraExpected + qrExpected;
  const extrasProcessed = loadedExtras + failedExtras;
  const imagesReady = renderEntries.length > 0 && processedImages === renderEntries.length;
  const extrasReady = extrasProcessed === extrasExpected;
  const canPrint =
    imagesReady && extrasReady && failedImages === 0 && failedExtras === 0;
  const totalPages = bodyPages.length + (institutional ? 5 : 2);
  const whatsappUrl =
    institutional?.channels.whatsappUrl || LEGACY_WHATSAPP_URL;

  if (loading) {
    return (
      <main className={`catalog-render-status catalog-render--${pdfLine.toLowerCase().replace('_', '-')}`}>
        <h1>Preparando catálogo...</h1>
        <p>Se están cargando los snapshots inmutables.</p>
      </main>
    );
  }

  if (error || !first) {
    const emptyMessage =
      !error && pdfLine !== 'ALL'
        ? `La versión no contiene entradas visibles para ${pdfLineLabel}.`
        : 'La versión no contiene entradas visibles.';

    return (
      <main className="catalog-render-status">
        <h1>No fue posible preparar el catálogo</h1>
        <p>{error || emptyMessage}</p>
        <Link to="/catalogs">Volver a Catálogos</Link>
      </main>
    );
  }

  return (
    <main className="catalog-print-root">
      <aside className="catalog-render-toolbar no-print">
        <div>
          <strong>{first.catalogTitle} · {first.versionLabel}</strong>
          <span>
            {renderEntries.length} productos · imágenes {processedImages}/{renderEntries.length}
            {institutional ? ` · institucional ${extrasProcessed}/${extrasExpected}` : ''}
            {failedImages + failedExtras > 0
              ? ` · ${failedImages + failedExtras} con error`
              : ''}{' '}
            · {totalPages} páginas estimadas
          </span>
        </div>
        <div className="catalog-render-actions">
          <Link className="catalog-render-back" to="/catalogs">Volver</Link>
          <button type="button" disabled={!canPrint} onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </button>
        </div>
      </aside>

      {failedImages + failedExtras > 0 ? (
        <div className="catalog-render-warning no-print" role="alert">
          Hay activos que no cargaron. El PDF permanece bloqueado para evitar publicar
          un catálogo incompleto.
        </div>
      ) : null}

      {institutional && pdfLine === 'ALL' ? (
        <section className="catalog-sheet catalog-reference-cover">
          <img src={catalogCoverPageOne} alt="Portada oficial del catálogo LIHEN" />
        </section>
      ) : (
        <section className="catalog-sheet catalog-cover catalog-pastel-page">
          <div className="catalog-orb catalog-orb-one" />
          <div className="catalog-orb catalog-orb-two" />
          <div className="catalog-cover-title-box">CATÁLOGO</div>
          <div className="catalog-cover-official">OFICIAL</div>
          <div className="catalog-cover-center">
            <div className="catalog-cover-logo-card">
              <img className="catalog-cover-logo" src={lihenLogoOfficial} alt="Logo oficial LIHEN" />
            </div>
            <div className="catalog-cloud catalog-cloud-mini">♥</div>
          </div>
          <p className="catalog-cover-copy">
            {pdfLine === 'BEAUTY_CARE'
              ? 'Descubre una selección enfocada en belleza, cuidado y bienestar.'
              : pdfLine === 'STYLE'
                ? 'Descubre una selección editorial de moda y estilo LIHEN.'
                : 'Descubre productos elegidos para tu cuidado y estilo.'}
          </p>
          <div className="catalog-cover-tagline">{pdfLineLabel}</div>
          <div className="catalog-cover-footer"><span>{first.catalogCode}</span><span>{first.versionLabel}</span></div>
        </section>
      )}

      {institutional ? (
        <>
          <section className="catalog-sheet catalog-about-page catalog-pastel-page">
            <div className="catalog-institutional-title">{institutional.aboutTitle}</div>
            <div className="catalog-about-layout">
              <div className="catalog-about-copy">{institutional.aboutBody}</div>
              {institutional.aboutImageUrl ? (
                <img
                  className="catalog-about-photo"
                  src={institutional.aboutImageUrl}
                  alt="Imagen institucional LIHEN"
                  onLoad={() => setLoadedExtras((value) => value + 1)}
                  onError={() => setFailedExtras((value) => value + 1)}
                />
              ) : (
                <div className="catalog-about-placeholder">LIHEN.CO</div>
              )}
            </div>
            <div className="catalog-info-tagline">{pdfLine === 'ALL' ? institutional.footerLabel : pdfLineLabel}</div>
            <div className="catalog-simple-footer"><span>LIHEN.CO</span><span>PÁGINA 2 DE {totalPages}</span></div>
          </section>

          <section className="catalog-sheet catalog-purchase-page catalog-pastel-page">
            <div className="catalog-institutional-title">{institutional.purchaseTitle}</div>
            <p className="catalog-purchase-intro">{institutional.purchaseIntro}</p>
            <div className="catalog-purchase-sections">
              {institutional.purchaseSections.map((section) => (
                <p key={section.key}><strong>{section.label}:</strong> {section.body}</p>
              ))}
            </div>
            <div className="catalog-qr-pair">
              {purchaseQrs.map((descriptor) => (
                <div className="catalog-qr-card" key={descriptor.key}>
                  <QrImage descriptor={descriptor} onReady={() => setLoadedExtras((value) => value + 1)} onError={() => setFailedExtras((value) => value + 1)} />
                  <strong>{descriptor.label}</strong>
                </div>
              ))}
            </div>
            <div className="catalog-info-tagline">{pdfLine === 'ALL' ? institutional.footerLabel : pdfLineLabel}</div>
            <div className="catalog-legal-footer">
              <span>{institutional.legalName}</span>
              {institutional.taxId ? <span>{institutional.taxId}</span> : null}
              {institutional.locationText ? <span>{institutional.locationText}</span> : null}
            </div>
          </section>

          <section className="catalog-sheet catalog-payments-page catalog-pastel-page">
            <div className="catalog-institutional-title">{institutional.paymentTitle}</div>
            <div className="catalog-payment-grid">
              {paymentMethods.map((method) => {
                const descriptor: QrDescriptor = {
                  key: method.id,
                  label: method.label,
                  value: method.qrValue,
                  sourceType: method.qrSourceType,
                };
                return (
                  <div className="catalog-payment-card" key={method.id}>
                    <QrImage descriptor={descriptor} onReady={() => setLoadedExtras((value) => value + 1)} onError={() => setFailedExtras((value) => value + 1)} />
                    <strong>{method.label}</strong>
                    {method.identifier ? <span>{method.identifier}</span> : null}
                  </div>
                );
              })}
              {paymentMethods.length === 0 ? (
                <div className="catalog-payment-empty">Medios de pago por configurar.</div>
              ) : null}
            </div>
            <div className="catalog-info-tagline">{pdfLine === 'ALL' ? institutional.footerLabel : pdfLineLabel}</div>
            <div className="catalog-simple-footer"><span>LIHEN.CO</span><span>PÁGINA 4 DE {totalPages}</span></div>
          </section>
        </>
      ) : (
        <section className="catalog-sheet catalog-info-page catalog-pastel-page">
          <div className="catalog-info-title">INFORMACIÓN IMPORTANTE DE COMPRA</div>
          <div className="catalog-info-panel">
            <ul>
              <li><strong>Precios:</strong> los valores mostrados corresponden al snapshot oficial de esta versión del catálogo.</li>
              <li><strong>Disponibilidad:</strong> confirma disponibilidad antes de finalizar tu compra.</li>
              <li><strong>Imágenes:</strong> son referencias visuales congeladas para esta versión.</li>
              <li><strong>Consulta rápida:</strong> usa el botón de WhatsApp de cada producto.</li>
              <li><strong>Versión:</strong> cada edición es inmutable para conservar trazabilidad.</li>
            </ul>
          </div>
          <a className="catalog-info-whatsapp" href={whatsappUrl}><WhatsAppMark /><span>CONSULTAR POR WHATSAPP</span></a>
          <div className="catalog-info-tagline">{pdfLineLabel}</div>
          <div className="catalog-simple-footer"><span>LIHEN.CO</span><span>PÁGINA 2 DE {totalPages}</span></div>
        </section>
      )}

      {bodyPages.map((page, bodyIndex) => {
        const pageNumber = bodyIndex + (institutional ? 5 : 3);

        if (page.type === 'brand') {
          return (
            <section className="catalog-sheet catalog-brand-page catalog-pastel-page" key={`brand-${bodyIndex}-${page.brand}`}>
              <div className="catalog-brand-heading">MARCA DESTACADA</div>
              <div className="catalog-brand-logo-card"><span>{page.brand}</span></div>
              <div className="catalog-brand-tagline">{pdfLine === 'ALL' ? (institutional?.footerLabel || pdfLineLabel) : pdfLineLabel}</div>
              <div className="catalog-simple-footer"><span>LIHEN.CO</span><span>PÁGINA {pageNumber} DE {totalPages}</span></div>
            </section>
          );
        }

        return (
          <section className="catalog-sheet catalog-products-page catalog-pastel-page" key={`products-${bodyIndex}-${page.brand}`}>
            <header className="catalog-products-heading"><strong>PRODUCTOS</strong><span>CATÁLOGO OFICIAL</span></header>
            <div className="catalog-product-grid">
              {page.entries.map((entry) => (
                <article className="catalog-product-card" key={entry.catalogEntryId}>
                  <div className="catalog-product-image-frame">
                    <img src={entry.imageUrl} alt={entry.imageAlt || entry.productName} loading="eager" onLoad={() => setLoadedImages((value) => value + 1)} onError={() => setFailedImages((value) => value + 1)} />
                  </div>
                  <div className="catalog-product-content">
                    <p className="catalog-product-brand">{normalizeBrand(entry)}</p>
                    <h2>{entry.productName}</h2>
                    <p className="catalog-product-sku">{entry.sku || entry.productCatalogCode || entry.businessLine}</p>
                    <div className="catalog-product-actions">
                      <span className="catalog-product-price">{formatPrice(entry.salePrice)}</span>
                      <a className="catalog-product-whatsapp" href={whatsappUrl} aria-label={`Consultar ${entry.productName} por WhatsApp`}><WhatsAppMark /></a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <footer className="catalog-simple-footer catalog-products-footer"><span>LIHEN.CO</span><span>PÁGINA {pageNumber} DE {totalPages}</span></footer>
          </section>
        );
      })}

      {institutional ? (
        <section className="catalog-sheet catalog-connect-page catalog-pastel-page">
          <div className="catalog-institutional-title">{institutional.connectTitle}</div>
          <p className="catalog-connect-message">{institutional.connectMessage}</p>
          <div className="catalog-connect-grid">
            {channelQrs.map((descriptor) => (
              <div className="catalog-qr-card" key={descriptor.key}>
                <QrImage descriptor={descriptor} onReady={() => setLoadedExtras((value) => value + 1)} onError={() => setFailedExtras((value) => value + 1)} />
                <strong>{descriptor.label}</strong>
              </div>
            ))}
          </div>
          <div className="catalog-info-tagline">{pdfLine === 'ALL' ? institutional.footerLabel : pdfLineLabel}</div>
          <div className="catalog-simple-footer"><span>LIHEN.CO</span><span>PÁGINA {totalPages} DE {totalPages}</span></div>
        </section>
      ) : null}
    </main>
  );
}
