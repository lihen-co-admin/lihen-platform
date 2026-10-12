import { FormEvent, useEffect, useMemo, useState, type ClipboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
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
  imageFileFromUrl,
  optimizeProductImage,
  LIHEN_MAX_IMAGES,
} from '../lib/product-image-webp';
import {
  visualIntelligenceComposition,
  type VisualIntelligenceSessionSummary,
} from '../composition/visual-intelligence';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type StagedImage = {
  readonly key: string;
  readonly file: File;
  readonly previewUrl: string;
  readonly originalBytes: number;
};

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

function mediaStatusLabel(images: readonly ProductImageDTO[], canReadImages: boolean): string {
  if (!canReadImages) return 'Lectura bloqueada';
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
  const [webpSaveBusy, setWebpSaveBusy] = useState(false);
  const [staged, setStaged] = useState<readonly StagedImage[]>([]);
  const [stagedMessage, setStagedMessage] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
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
        explanation:
          'La lectura persistente de imágenes está bloqueada por configuración. LIHEN no debe inferir readiness de publicación sin evidencia legible.',
        source: 'Product media gate',
      });
      return result;
    }

    if (images.length === 0) {
      result.push({
        id: 'no-media',
        severity: 'WARNING',
        title: 'Producto sin media registrada',
        explanation:
          'Sin imagen canónica no debe considerarse listo para catálogo o storefront. Agrega evidencia aprobada antes de publicar.',
        source: 'Product media',
      });
    } else if (!mainImage) {
      result.push({
        id: 'no-main-image',
        severity: 'WARNING',
        title: 'Falta imagen principal',
        explanation:
          'Existe galería, pero ninguna imagen está marcada como principal. Esa decisión debe ser explícita antes de usar el producto en superficies públicas.',
        source: 'Product media',
      });
    }

    if (images.length > 0 && altCoverage < images.length) {
      result.push({
        id: 'alt-coverage',
        severity: 'INFO',
        title: `${images.length - altCoverage} imágenes sin texto alternativo`,
        explanation:
          'Completar el texto alternativo mejora accesibilidad y evita que la galería se considere terminada solo por tener archivos visibles.',
        source: 'Accesibilidad media',
      });
    }

    if (images.length > 0 && mainImage && altCoverage === images.length) {
      result.push({
        id: 'media-operational-ready',
        severity: 'SUCCESS',
        title: 'Media operativamente completa',
        explanation:
          'La galería tiene imagen principal y cobertura de texto alternativo. Esto no equivale por sí solo a elegibilidad de publicación: catálogo y storefront deben validar sus reglas canónicas.',
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
        explanation:
          'Puede registrar evidencia visual y producir señales explicables, pero no convierte una observación en imagen publicada ni modifica Product Master automáticamente.',
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

  useEffect(
    () => () => {
      if (lensPreviewUrl) URL.revokeObjectURL(lensPreviewUrl);
    },
    [lensPreviewUrl],
  );

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

  async function stageFiles(files: readonly File[]): Promise<void> {
    if (!productsComposition.canReadImages || optimizing) {
      setStagedMessage('Espera a que finalice la conversión o habilita la lectura de galería.');
      return;
    }
    setOptimizing(true);
    const remaining = Math.max(0, LIHEN_MAX_IMAGES - images.length - staged.length);
    const seen = new Set(staged.map((entry) => entry.key));
    const incoming: StagedImage[] = [];
    const errors: string[] = [];
    try {
      for (const source of files) {
        if (incoming.length >= remaining) {
          errors.push('Máximo 10 imágenes por producto.');
          break;
        }
        try {
          const optimized = await optimizeProductImage(source);
          const hash = await sha256Hex(optimized.file);
          if (seen.has(hash)) {
            errors.push(`${source.name}: duplicado.`);
            continue;
          }
          seen.add(hash);
          incoming.push({
            key: hash,
            file: optimized.file,
            originalBytes: optimized.originalBytes,
            previewUrl: URL.createObjectURL(optimized.file),
          });
        } catch (error) {
          errors.push(
            `${source.name}: ${error instanceof Error ? error.message : 'Error de conversión'}`,
          );
        }
      }
      setStaged((previous) => [...previous, ...incoming]);
      setStagedMessage(
        [incoming.length ? `${incoming.length} imagen(es) convertida(s) a WebP.` : '', ...errors]
          .filter(Boolean)
          .join(' '),
      );
    } finally {
      setOptimizing(false);
    }
  }

  async function stageUrlImage(): Promise<void> {
    setStagedMessage('Importando URL y convirtiendo a WebP…');
    try {
      const source = await imageFileFromUrl(publicUrl);
      await stageFiles([source]);
      setPublicUrl('');
    } catch (error) {
      setStagedMessage(error instanceof Error ? error.message : 'No fue posible importar la URL.');
    }
  }

  function removeStaged(key: string): void {
    setStaged((previous) => {
      const match = previous.find((entry) => entry.key === key);
      if (match) URL.revokeObjectURL(match.previewUrl);
      return previous.filter((entry) => entry.key !== key);
    });
  }

  function handleClipboardPaste(event: ClipboardEvent<HTMLDivElement>): void {
    const image = Array.from(event.clipboardData.files).find((file) =>
      ALLOWED_IMAGE_TYPES.has(file.type),
    );
    if (image) {
      event.preventDefault();
      void stageFiles([image]);
    }
  }

  async function saveOptimizedImages(): Promise<void> {
    if (
      !id ||
      !authorized ||
      !productsComposition.canUploadWebp ||
      !productsComposition.canReadImages
    ) {
      setError(
        'Para guardar WebP debes confirmar autorización y habilitar escritura controlada en DEV.',
      );
      return;
    }
    if (!staged.length || images.length + staged.length > 10) {
      setError('Verifica que la galería tenga entre 1 y 10 imágenes en total.');
      return;
    }
    setWebpSaveBusy(true);
    setError(null);
    try {
      // Sequential uploads keep gallery count bounded; never register before uploading.
      let registeredCount = images.length;
      for (const entry of staged) {
        const file = entry.file;
        if (file.type !== 'image/webp') throw new Error('El archivo preparado no es WebP.');
        const uploaded = await productsComposition.uploadProductWebp(id, file);
        await productsComposition.registerProductWebp({
          productId: id,
          imageId: uploaded.imageId,
          sha256: uploaded.sha256,
          altText: file.name.replace(/\.webp$/i, ''),
          makeMain: registeredCount === 0,
        });
        registeredCount++;
      }
      await refresh(id);
      setStaged([]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `No se completó el guardado WebP: ${cause.message}. Verifica la galería antes de reintentar; podría existir un archivo pendiente en Storage.`
          : 'No se completó el guardado WebP.',
      );
    } finally {
      setWebpSaveBusy(false);
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(
      'La URL debe convertirse a WebP y guardarse mediante Storage DEV autorizado. El registro directo está bloqueado.',
    );
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
    <section className="stack">
      <AdminPageHero
        eyebrow="PRODUCT MASTER · MEDIA"
        title={product ? `Imágenes · ${product.name}` : 'Imágenes del producto'}
        description="Administra la galería canónica, revisa completitud visual y usa Lens Mode como evidencia asistida sin convertir señales en publicación automática."
        accent="lilac"
        actions={
          <Link
            className="button-link button-link--secondary"
            to={id ? `/products/${id}` : '/products'}
          >
            ← Volver al producto
          </Link>
        }
        status={
          product ? (
            <span className="status-badge">
              {mediaStatusLabel(images, productsComposition.canReadImages)}
            </span>
          ) : undefined
        }
      />

      {loading ? <div className="empty-state">Cargando imágenes…</div> : null}
      {error ? (
        <div className="error-state" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !product ? <div className="empty-state">Producto no encontrado.</div> : null}

      {!loading && product ? (
        <>
          <SummaryStrip
            items={[
              {
                label: 'Imágenes',
                value: productsComposition.canReadImages ? images.length : 'No verificable',
                detail: productsComposition.canReadImages ? 'registradas' : 'lectura bloqueada',
              },
              {
                label: 'Principal',
                value: productsComposition.canReadImages
                  ? mainImage
                    ? 'Sí'
                    : 'No'
                  : 'No verificable',
              },
              {
                label: 'Alt text',
                value: productsComposition.canReadImages
                  ? `${altCoverage}/${images.length}`
                  : 'No verificable',
                detail: productsComposition.canReadImages
                  ? 'cobertura accesible'
                  : 'lectura bloqueada',
              },
              {
                label: 'Lens Mode',
                value: visualIntelligenceComposition.enabled ? 'DEV activo' : 'Bloqueado',
                detail: 'solo evidencia asistida',
              },
            ]}
          />

          <OperationalNotice
            title="Media readiness no es publicación"
            tone="info"
            meta="Boundary de publicación"
          >
            <p>
              Tener galería completa no publica el producto. Catálogo y storefront conservan su
              propia elegibilidad canónica y deben validar estado, precio, imagen y demás reglas
              antes de exponerlo.
            </p>
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
                <p className="muted-text">
                  Adjunta una foto o pantallazo para registrar evidencia visual por SHA-256 y dejar
                  el caso listo para señales, candidatos y decisión humana explicable.
                </p>
              </div>
              <span className="status-badge">DEV · READ ONLY ASSIST</span>
            </div>

            {!visualIntelligenceComposition.enabled ? (
              <div className="warning-state">
                <strong>Lens Mode está bloqueado por configuración.</strong>
                <p>
                  El modo visual solo debe habilitarse en DEV con autenticación y controles activos.
                  Su bloqueo no afecta la galería canónica.
                </p>
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
                    Seleccionar un archivo crea intake de evidencia. No lo convierte en media
                    publicada ni reemplaza la aprobación humana.
                  </small>
                  {lensError ? (
                    <div className="error-state" role="alert">
                      {lensError}
                    </div>
                  ) : null}
                  {lensBusy ? (
                    <div className="info-state">
                      <p>Registrando evidencia visual…</p>
                    </div>
                  ) : null}
                </div>

                {lensPreviewUrl ? (
                  <div className="lens-preview-card">
                    <img
                      src={lensPreviewUrl}
                      alt={`Vista previa ${lensFileName ?? product.name}`}
                    />
                    <small className="muted-text">{lensFileName}</small>
                  </div>
                ) : null}
              </div>
            )}

            {lensSession ? (
              <div className="lens-result" aria-live="polite">
                <div className="lens-result__summary">
                  <div>
                    <span>Sesión</span>
                    <strong className="code-text">{lensSession.sessionId}</strong>
                  </div>
                  <div>
                    <span>Estado</span>
                    <strong>{lensSession.status}</strong>
                  </div>
                  <div>
                    <span>Alcance</span>
                    <strong>{lensSession.identityScope ?? 'PENDIENTE'}</strong>
                  </div>
                  <div>
                    <span>Señales</span>
                    <strong>{lensSession.signalCount}</strong>
                  </div>
                  <div>
                    <span>Candidatos</span>
                    <strong>{lensSession.candidateCount}</strong>
                  </div>
                  <div>
                    <span>Revisión humana</span>
                    <strong>{lensSession.requiresHumanReview ? 'Sí' : 'No'}</strong>
                  </div>
                </div>
                {lensSession.decisionStatus ? (
                  <div className="info-state">
                    <strong>{lensSession.decisionStatus}</strong>
                    <p>
                      {[
                        lensSession.decidedBrand,
                        lensSession.decidedProductName,
                        lensSession.decidedVariant,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Decisión registrada sin atribución de marca.'}
                    </p>
                    {lensSession.nextAction ? (
                      <p>
                        <strong>Siguiente acción:</strong> {lensSession.nextAction}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="info-state">
                    <strong>Intake recibido</strong>
                    <p>
                      La sesión existe, pero todavía no debe interpretarse como aprobación de
                      identidad, media o publicación.
                    </p>
                  </div>
                )}
                <button type="button" disabled={lensBusy} onClick={() => void refreshLensSession()}>
                  Actualizar estado Lens Mode
                </button>
              </div>
            ) : null}
          </section>

          <section className="detail-card" aria-labelledby="image-intake-title">
            <h2 id="image-intake-title">
              Incorporar imágenes · {images.length + staged.length}/{LIHEN_MAX_IMAGES}
            </h2>
            <p className="muted-text">
              Adjuntar y arrastrar: varias a la vez. Pegar Ctrl+V: una a la vez. URL: una a la vez.
            </p>
            <div
              role="group"
              aria-label="Arrastrar o pegar imágenes"
              tabIndex={0}
              onPaste={handleClipboardPaste}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void stageFiles(Array.from(event.dataTransfer.files));
              }}
              style={{ border: '2px dashed #c2a2c8', borderRadius: 12, padding: 20 }}
            >
              <strong>Arrastra fotos aquí o pega una imagen con Ctrl+V</strong>
              <label className="form-stack">
                Adjuntar varios archivos
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  disabled={
                    optimizing ||
                    !productsComposition.canReadImages ||
                    images.length + staged.length >= LIHEN_MAX_IMAGES
                  }
                  onChange={(event) => {
                    void stageFiles(Array.from(event.target.files ?? []));
                    event.target.value = '';
                  }}
                />
              </label>
              <small>
                JPG, PNG y WebP hasta 12 MB. Conversión automática: WebP calidad 0,85, máximo 2000
                px.
              </small>
            </div>
            {stagedMessage ? <p role="status">{stagedMessage}</p> : null}
            {staged.length > 0 ? (
              <div className="image-grid">
                {staged.map((entry) => (
                  <article className="image-card" key={entry.key}>
                    <img src={entry.previewUrl} alt={entry.file.name} />
                    <p>
                      {entry.file.name} · {(entry.originalBytes / 1024).toFixed(0)} KB →{' '}
                      {(entry.file.size / 1024).toFixed(0)} KB WebP
                    </p>
                    <button type="button" onClick={() => removeStaged(entry.key)}>
                      Quitar
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={authorized}
                onChange={(event) => setAuthorized(event.target.checked)}
              />
              Confirmo que tengo autorización para usar estas imágenes en LIHEN.CO.
            </label>
            {staged.length > 0 ? (
              <p role="status" className="muted-text">
                Vista previa local solamente. Aún no se han guardado las imágenes: falta la
                autorización de Storage DEV y la integración de persistencia.
              </p>
            ) : null}
          </section>

          <section className="detail-card" aria-labelledby="webp-url-title">
            <h2 id="webp-url-title">Importar imagen desde URL HTTPS</h2>
            <p className="muted-text">
              Una por operación. La URL se descarga y convierte a WebP antes de preparar la vista
              previa; enlaces sin CORS se rechazan.
            </p>
            <label>
              URL de imagen
              <input
                type="url"
                value={publicUrl}
                onChange={(event) => setPublicUrl(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={
                !publicUrl || optimizing || images.length + staged.length >= LIHEN_MAX_IMAGES
              }
              onClick={() => void stageUrlImage()}
            >
              Convertir URL a WebP
            </button>
          </section>

          <section className="detail-card" aria-label="Guardar archivos WebP optimizados">
            <h2>Guardar imágenes optimizadas</h2>
            <p>
              Se almacenará exclusivamente la versión WebP y después se registrará en Product Master
              DEV. No inicia publicaciones.
            </p>
            {!productsComposition.canUploadWebp ? (
              <p role="status">
                Guardado deshabilitado: requiere habilitación controlada de Storage y Product Images
                en DEV.
              </p>
            ) : null}
            <button
              type="button"
              disabled={
                !authorized ||
                !staged.length ||
                webpSaveBusy ||
                !productsComposition.canUploadWebp ||
                images.length + staged.length > 10
              }
              onClick={() => void saveOptimizedImages()}
            >
              {webpSaveBusy ? 'Guardando WebP…' : `Guardar ${staged.length} WebP en Product Master`}
            </button>
          </section>

          <section className="detail-card" aria-labelledby="media-registration-title">
            <h2 id="media-registration-title">Registrar media canónica</h2>
            {!productsComposition.canManageImages ? (
              <p className="muted-text">
                El registro de URL continúa bloqueado por PRODUCT_IMAGE_WRITE. La vista previa de
                archivos es local; todavía no guarda imágenes. Lens Mode es independiente.
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
                <button
                  type="submit"
                  disabled
                  title="La URL original no se registra: primero debe convertirse y subirse como WebP autorizado"
                >
                  Registro directo de URL deshabilitado
                </button>
              </form>
            )}
          </section>

          <section className="detail-card" aria-labelledby="product-images-title">
            <h2 id="product-images-title">Galería canónica</h2>
            {!productsComposition.canReadImages ? (
              <p className="muted-text">
                La lectura persistente de product_images está protegida por configuración y
                autorización.
              </p>
            ) : images.length === 0 ? (
              <div className="empty-state">
                <strong>Sin imágenes registradas.</strong>
                <p>
                  El producto todavía no tiene media canónica disponible para evaluar visualmente.
                </p>
              </div>
            ) : (
              <div className="image-grid">
                {images.map((image) => (
                  <article className="image-card" key={image.id}>
                    <img src={image.publicUrl} alt={image.altText ?? product.name} />
                    <div>
                      <strong>{image.isMain ? 'Principal' : `Orden ${image.sortOrder}`}</strong>
                      <p className="muted-text">{image.altText ?? 'Sin texto alternativo'}</p>
                      <small className="muted-text">Fuente: {image.sourceType}</small>
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
