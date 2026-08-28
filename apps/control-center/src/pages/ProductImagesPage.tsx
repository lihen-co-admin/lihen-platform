import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createAddProductImageCommand,
  createGetProductImagesQuery,
  createSetMainProductImageCommand,
  type ProductDetailDTO,
  type ProductImageDTO,
  createGetProductByIdQuery,
} from '@lihen/products';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { productsComposition } from '../composition/products';
import {
  visualIntelligenceComposition,
  type VisualIntelligenceSessionSummary,
} from '../composition/visual-intelligence';

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function buildLensAssetReference(productId: string, file: File): Promise<string> {
  const sha256 = await sha256Hex(file);
  const query = new URLSearchParams({
    name: file.name,
    mime: file.type || 'application/octet-stream',
    bytes: String(file.size),
  });
  return `control-center://lens-pending/${productId}/${sha256}?${query.toString()}`;
}

function mediaStatusLabel(images: readonly ProductImageDTO[]): string {
  if (images.length === 0) return 'Sin media';
  if (!images.some((image) => image.isMain)) return 'Falta principal';
  if (images.some((image) => !image.altText?.trim())) return 'Revisar accesibilidad';
  return 'Media completa';
}

export function ProductImagesPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [images, setImages] = useState<readonly ProductImageDTO[]>([]);
  const [publicUrl, setPublicUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [makeMain, setMakeMain] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lensBusy, setLensBusy] = useState(false);
  const [lensError, setLensError] = useState<string | null>(null);
  const [lensSession, setLensSession] = useState<VisualIntelligenceSessionSummary | null>(null);
  const [lensPreviewUrl, setLensPreviewUrl] = useState<string | null>(null);
  const [lensFileName, setLensFileName] = useState<string | null>(null);

  const mainImage = useMemo(() => images.find((image) => image.isMain) ?? null, [images]);
  const altCoverage = useMemo(
    () => images.filter((image) => Boolean(image.altText?.trim())).length,
    [images],
  );

  const insights = useMemo<readonly IntelligenceInsight[]>(() => {
    if (!product) return [];
    const result: IntelligenceInsight[] = [];

    if (!productsComposition.canReadImages) {
      result.push({
        id: 'media-read-gate',
        severity: 'WARNING',
        title: 'Readiness visual no verificable',
        explanation: 'La lectura persistente de imágenes está bloqueada por configuración. LIHEN no debe inferir readiness de publicación sin evidencia legible.',
        source: 'Product media gate',
      });
      return result;
    }

    if (images.length === 0) {
      result.push({
        id: 'no-media',
        severity: 'WARNING',
        title: 'Producto sin media registrada',
        explanation: 'Sin imagen canónica no debe considerarse listo para catálogo o storefront. Agrega evidencia aprobada antes de publicar.',
        source: 'Product media',
      });
    } else if (!mainImage) {
      result.push({
        id: 'no-main-image',
        severity: 'WARNING',
        title: 'Falta imagen principal',
        explanation: 'Existe galería, pero ninguna imagen está marcada como principal. Esa decisión debe ser explícita antes de usar el producto en superficies públicas.',
        source: 'Product media',
      });
    }

    if (images.length > 0 && altCoverage < images.length) {
      result.push({
        id: 'alt-coverage',
        severity: 'INFO',
        title: `${images.length - altCoverage} imágenes sin texto alternativo`,
        explanation: 'Completar el texto alternativo mejora accesibilidad y evita que la galería se considere terminada solo por tener archivos visibles.',
        source: 'Accesibilidad media',
      });
    }

    if (images.length > 0 && mainImage && altCoverage === images.length) {
      result.push({
        id: 'media-operational-ready',
        severity: 'SUCCESS',
        title: 'Media operativamente completa',
        explanation: 'La galería tiene imagen principal y cobertura de texto alternativo. Esto no equivale por sí solo a elegibilidad de publicación: catálogo y storefront deben validar sus reglas canónicas.',
        actionLabel: 'Revisar catálogos',
        targetRoute: '/catalogs',
        source: 'Product media + publication boundary',
      });
    }

    if (visualIntelligenceComposition.enabled) {
      result.push({
        id: 'lens-available',
        severity: 'INFO',
        title: 'Lens Mode disponible en DEV',
        explanation: 'Puede registrar evidencia visual y producir señales explicables, pero no convierte una observación en imagen publicada ni modifica Product Master automáticamente.',
        source: 'LIHEN Visual Intelligence',
      });
    }

    return result;
  }, [altCoverage, images, mainImage, product]);

  async function refresh(productId: string): Promise<void> {
    const [detail, productImages] = await Promise.all([
      productsComposition.getProductById.execute(createGetProductByIdQuery(productId)),
      productsComposition.canReadImages
        ? productsComposition.getProductImages.execute(createGetProductImagesQuery(productId))
        : Promise.resolve([]),
    ]);
    setProduct(detail);
    setImages(productImages);
  }

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    refresh(id)
      .catch(() => setError('No fue posible cargar las imágenes del producto.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => () => {
    if (lensPreviewUrl) URL.revokeObjectURL(lensPreviewUrl);
  }, [lensPreviewUrl]);

  async function handleLensAttachment(file?: File): Promise<void> {
    if (!file || !id || !visualIntelligenceComposition.enabled) return;
    setLensBusy(true);
    setLensError(null);
    setLensSession(null);
    setLensFileName(file.name);
    setLensPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });

    try {
      const assetReference = await buildLensAssetReference(id, file);
      const sessionId = await visualIntelligenceComposition.startSession(id, assetReference);
      const summary = await visualIntelligenceComposition.getSessionSummary(sessionId);
      if (!summary) throw new Error('No fue posible leer el intake de Lens Mode.');
      setLensSession(summary);
    } catch (cause) {
      setLensError(cause instanceof Error ? cause.message : 'No fue posible iniciar Lens Mode.');
    } finally {
      setLensBusy(false);
    }
  }

  async function refreshLensSession(): Promise<void> {
    if (!lensSession) return;
    setLensBusy(true);
    setLensError(null);
    try {
      const summary = await visualIntelligenceComposition.getSessionSummary(lensSession.sessionId);
      if (summary) setLensSession(summary);
    } catch (cause) {
      setLensError(cause instanceof Error ? cause.message : 'No fue posible actualizar Lens Mode.');
    } finally {
      setLensBusy(false);
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!id || !productsComposition.canManageImages) return;
    setError(null);
    try {
      await productsComposition.addProductImage.execute(
        createAddProductImageCommand({
          productId: id,
          publicUrl,
          ...(altText.trim() ? { altText } : {}),
          makeMain,
        }),
      );
      setPublicUrl('');
      setAltText('');
      setMakeMain(false);
      await refresh(id);
    } catch {
      setError('No fue posible agregar la imagen. Verifica la URL y vuelve a intentarlo.');
    }
  }

  async function handleSetMain(imageId: string): Promise<void> {
    if (!id || !productsComposition.canManageImages) return;
    setError(null);
    try {
      const updated = await productsComposition.setMainProductImage.execute(
        createSetMainProductImageCommand(id, imageId),
      );
      setImages(updated);
    } catch {
      setError('No fue posible establecer la imagen principal.');
    }
  }

  return (
    <section>
      <AdminPageHero
        eyebrow="PRODUCT MASTER · MEDIA"
        title={product ? `Imágenes · ${product.name}` : 'Imágenes del producto'}
        description="Administra la galería canónica, revisa completitud visual y usa Lens Mode como evidencia asistida sin convertir señales en publicación automática."
        accent="lilac"
        actions={<Link className="button-link button-link--secondary" to={id ? `/products/${id}` : '/products'}>← Volver al producto</Link>}
        status={product ? <span className="status-badge">{mediaStatusLabel(images)}</span> : undefined}
      />

      {loading ? <div className="empty-state">Cargando imágenes…</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}

      {!loading && !product ? <div className="empty-state">Producto no encontrado.</div> : null}

      {!loading && product ? (
        <>
          <SummaryStrip
            items={[
              { label: 'Imágenes', value: images.length, detail: productsComposition.canReadImages ? 'registradas' : 'lectura bloqueada' },
              { label: 'Principal', value: mainImage ? 'Sí' : 'No' },
              { label: 'Alt text', value: `${altCoverage}/${images.length}`, detail: 'cobertura accesible' },
              { label: 'Lens Mode', value: visualIntelligenceComposition.enabled ? 'DEV activo' : 'Bloqueado', detail: 'solo evidencia asistida' },
            ]}
          />

          <OperationalNotice title="Media readiness no es publicación" tone="info" meta="Boundary de publicación">
            <p>Tener galería completa no publica el producto. Catálogo y storefront conservan su propia elegibilidad canónica y deben validar estado, precio, imagen y demás reglas antes de exponerlo.</p>
          </OperationalNotice>

          <IntelligencePanel
            title="Readiness visual"
            description="Señales deterministas sobre completitud de media. No aprueba ni publica productos automáticamente."
            insights={insights}
          />

          <section className="detail-card lens-panel" aria-labelledby="lens-mode-title">
            <div className="lens-panel__heading">
              <div>
                <p className="eyebrow">LIHEN Visual Intelligence</p>
                <h2 id="lens-mode-title">Lens Mode</h2>
                <p className="muted-text">Adjunta una foto o pantallazo para registrar evidencia visual por SHA-256 y dejar el caso listo para señales, candidatos y decisión humana explicable.</p>
              </div>
              <span className="status-badge">DEV · READ ONLY ASSIST</span>
            </div>

            {!visualIntelligenceComposition.enabled ? (
              <div className="warning-state">
                <strong>Lens Mode está bloqueado por configuración.</strong>
                <p>El modo visual solo debe habilitarse en DEV con autenticación y controles activos. Su bloqueo no afecta la galería canónica.</p>
              </div>
            ) : (
              <div className="lens-layout">
                <div className="form-stack">
                  <label>
                    Foto o pantallazo del producto
                    <input type="file" accept="image/png,image/jpeg,image/webp" disabled={lensBusy} onChange={(event) => void handleLensAttachment(event.target.files?.[0])} />
                  </label>
                  <small className="muted-text">Seleccionar un archivo crea intake de evidencia. No lo convierte en media publicada ni reemplaza la aprobación humana.</small>
                  {lensError ? <div className="error-state" role="alert">{lensError}</div> : null}
                  {lensBusy ? <div className="info-state"><p>Registrando evidencia visual…</p></div> : null}
                </div>

                {lensPreviewUrl ? (
                  <div className="lens-preview-card">
                    <img src={lensPreviewUrl} alt={`Vista previa ${lensFileName ?? product.name}`} />
                    <small className="muted-text">{lensFileName}</small>
                  </div>
                ) : null}
              </div>
            )}

            {lensSession ? (
              <div className="lens-result" aria-live="polite">
                <div className="lens-result__summary">
                  <div><span>Sesión</span><strong className="code-text">{lensSession.sessionId}</strong></div>
                  <div><span>Estado</span><strong>{lensSession.status}</strong></div>
                  <div><span>Alcance</span><strong>{lensSession.identityScope ?? 'PENDIENTE'}</strong></div>
                  <div><span>Señales</span><strong>{lensSession.signalCount}</strong></div>
                  <div><span>Candidatos</span><strong>{lensSession.candidateCount}</strong></div>
                  <div><span>Revisión humana</span><strong>{lensSession.requiresHumanReview ? 'Sí' : 'No'}</strong></div>
                </div>
                {lensSession.decisionStatus ? (
                  <div className="info-state">
                    <strong>{lensSession.decisionStatus}</strong>
                    <p>{[lensSession.decidedBrand, lensSession.decidedProductName, lensSession.decidedVariant].filter(Boolean).join(' · ') || 'Decisión registrada sin atribución de marca.'}</p>
                    {lensSession.nextAction ? <p><strong>Siguiente acción:</strong> {lensSession.nextAction}</p> : null}
                  </div>
                ) : (
                  <div className="info-state"><strong>Intake recibido</strong><p>La sesión existe, pero todavía no debe interpretarse como aprobación de identidad, media o publicación.</p></div>
                )}
                <button type="button" disabled={lensBusy} onClick={() => void refreshLensSession()}>Actualizar estado Lens Mode</button>
              </div>
            ) : null}
          </section>

          <section className="detail-card" aria-labelledby="media-registration-title">
            <h2 id="media-registration-title">Registrar media canónica</h2>
            {!productsComposition.canManageImages ? (
              <p className="muted-text">La escritura de product_images continúa protegida por su gate. Lens Mode es independiente y no convierte evidencia en publicación.</p>
            ) : (
              <form className="form-stack" onSubmit={handleAdd}>
                <label>URL pública de imagen *<input aria-label="URL pública de imagen *" type="url" required value={publicUrl} onChange={(event) => setPublicUrl(event.target.value)} /></label>
                <label>Texto alternativo<input aria-label="Texto alternativo" value={altText} onChange={(event) => setAltText(event.target.value)} /></label>
                <label className="checkbox-row"><input type="checkbox" checked={makeMain} onChange={(event) => setMakeMain(event.target.checked)} />Convertir en imagen principal</label>
                <button type="submit">Agregar imagen</button>
              </form>
            )}
          </section>

          <section className="detail-card" aria-labelledby="product-images-title">
            <h2 id="product-images-title">Galería canónica</h2>
            {!productsComposition.canReadImages ? (
              <p className="muted-text">La lectura persistente de product_images está protegida por configuración y autorización.</p>
            ) : images.length === 0 ? (
              <div className="empty-state"><strong>Sin imágenes registradas.</strong><p>El producto todavía no tiene media canónica disponible para evaluar visualmente.</p></div>
            ) : (
              <div className="image-grid">
                {images.map((image) => (
                  <article className="image-card" key={image.id}>
                    <img src={image.publicUrl} alt={image.altText ?? product.name} />
                    <div>
                      <strong>{image.isMain ? 'Principal' : `Orden ${image.sortOrder}`}</strong>
                      <p className="muted-text">{image.altText ?? 'Sin texto alternativo'}</p>
                      <small className="muted-text">Fuente: {image.sourceType}</small>
                      {!image.isMain && productsComposition.canManageImages ? <button type="button" onClick={() => void handleSetMain(image.id)}>Hacer principal</button> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
