import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createAddProductImageCommand,
  createGetProductImagesQuery,
  createSetMainProductImageCommand,
  type ProductDetailDTO,
  type ProductImageDTO,
  createGetProductByIdQuery,
} from '@lihen/products';
import { PageHeader } from '../components/PageHeader';
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
      <PageHeader
        title="Imágenes del producto"
        description="FASE 5: galería controlada + LIHEN Visual Intelligence (Lens Mode). La selección visual no publica ni modifica Product Master automáticamente."
      />

      <div className="detail-actions">
        <Link to={id ? `/products/${id}` : '/products'}>← Volver al producto</Link>
      </div>

      {loading ? <div className="empty-state">Cargando imágenes…</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}

      {!loading && !product ? (
        <div className="empty-state">Producto no encontrado.</div>
      ) : null}

      {!loading && product ? (
        <>
          <section className="detail-card lens-panel" aria-labelledby="lens-mode-title">
            <div className="lens-panel__heading">
              <div>
                <p className="eyebrow">LIHEN Visual Intelligence</p>
                <h2 id="lens-mode-title">Lens Mode</h2>
                <p className="muted-text">
                  Adjunta una foto o pantallazo. LIHEN crea el intake visual, conserva la identidad del archivo por SHA-256 y deja el caso listo para extracción de señales, búsqueda y decisión explicable.
                </p>
              </div>
              <span className="status-badge">DEV · FASE 5</span>
            </div>

            {!visualIntelligenceComposition.enabled ? (
              <div className="warning-state">
                <strong>Lens Mode está bloqueado por configuración.</strong>
                <p>Habilita VITE_VISUAL_INTELLIGENCE_MODE=controlled únicamente en DEV con Supabase Auth activo.</p>
              </div>
            ) : (
              <div className="lens-layout">
                <div className="form-stack">
                  <label>
                    Foto o pantallazo del producto
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={lensBusy}
                      onChange={(event) => void handleLensAttachment(event.target.files?.[0])}
                    />
                  </label>
                  <small className="muted-text">
                    El intake es automático al seleccionar el archivo. Mientras el gate de Storage siga bloqueado, el archivo no se sube: se registra su huella y queda pendiente de ingestión segura.
                  </small>
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
                    <p>
                      {[lensSession.decidedBrand, lensSession.decidedProductName, lensSession.decidedVariant]
                        .filter(Boolean)
                        .join(' · ') || 'Decisión registrada sin atribución de marca.'}
                    </p>
                    {lensSession.nextAction ? <p><strong>Siguiente acción:</strong> {lensSession.nextAction}</p> : null}
                  </div>
                ) : (
                  <div className="info-state">
                    <strong>Intake recibido</strong>
                    <p>La sesión quedó creada. El procesador visual/web todavía debe extraer señales y candidatos antes de producir una decisión.</p>
                  </div>
                )}
                <button type="button" disabled={lensBusy} onClick={() => void refreshLensSession()}>
                  Actualizar estado Lens Mode
                </button>
              </div>
            ) : null}
          </section>

          <div className="detail-card">
            <h2>{product.name}</h2>
            {!productsComposition.canManageImages ? (
              <p className="muted-text">
                La escritura de product_images continúa controlada por su gate. Lens Mode es independiente y no convierte evidencia en publicación.
              </p>
            ) : (
              <form className="form-stack" onSubmit={handleAdd}>
                <label>
                  URL pública de imagen *
                  <input
                    aria-label="URL pública de imagen *"
                    type="url"
                    required
                    value={publicUrl}
                    onChange={(event) => setPublicUrl(event.target.value)}
                  />
                </label>
                <label>
                  Texto alternativo
                  <input
                    aria-label="Texto alternativo"
                    value={altText}
                    onChange={(event) => setAltText(event.target.value)}
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={makeMain}
                    onChange={(event) => setMakeMain(event.target.checked)}
                  />
                  Convertir en imagen principal
                </label>
                <button type="submit">Agregar imagen</button>
              </form>
            )}
          </div>

          <section className="detail-card" aria-labelledby="product-images-title">
            <h2 id="product-images-title">Galería</h2>
            {!productsComposition.canReadImages ? (
              <p className="muted-text">La lectura persistente de product_images se habilitará después del precheck DEV.</p>
            ) : images.length === 0 ? (
              <p className="muted-text">Este producto todavía no tiene imágenes registradas.</p>
            ) : (
              <div className="image-grid">
                {images.map((image) => (
                  <article className="image-card" key={image.id}>
                    <img src={image.publicUrl} alt={image.altText ?? product.name} />
                    <div>
                      <strong>{image.isMain ? 'Principal' : `Orden ${image.sortOrder}`}</strong>
                      <p className="muted-text">{image.altText ?? 'Sin texto alternativo'}</p>
                      {!image.isMain && productsComposition.canManageImages ? (
                        <button type="button" onClick={() => void handleSetMain(image.id)}>
                          Hacer principal
                        </button>
                      ) : null}
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
