import {
  analyzeProductPhoto,
  analyzeExistingProductPhoto,
} from '../composition/visual-intelligence';
import { PremiumCosmeticArtwork } from '../components/PremiumCosmeticArtwork';
import { isPilotProduct } from '../domain/product-pilot-scope';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createGetProductsQuery,
  createGetProductByIdQuery,
  createGetProductImagesQuery,
  type ProductDetailDTO,
  type ProductImageDTO,
} from '@lihen/products';
import { productsComposition } from '../composition/products';
import {
  useLocalLabData,
  loadLocalLabData,
  clearLocalLabData,
} from '../domain/product-master-lab-data';
import { useUnsavedChanges } from '../drafts/UnsavedChanges';
import {
  MASTER_FIELDS,
  buildProductMasterProjection,
  exportProductMasterCandidates,
  recoverProductMasterCandidates,
  identityBaseline,
  proposalIssues,
  reviewProposal,
  recoverReview,
  type IdentityProposal,
  type LocalReview,
  type ProductMasterCandidates,
} from '../domain/product-master-lab';
import { ProductMasterLabShell, LabIcon } from '../components/ProductMasterLabShell';
import {
  ProductFamilyLab,
  ProductProjectionReadOnly,
  ProductMasterCandidateReview,
  type ProjectionImageLoadState,
} from '../components/ProductFamilyLab';
import { VerifiedProductImagesPanel } from '../components/VerifiedProductImagesPanel';
import { useAuth } from '../auth/auth-context';
import {
  LIHEN_MAX_IMAGES,
  LIHEN_MANUAL_BATCH_LIMIT,
  optimizeProductImage,
} from '../lib/product-image-webp';
import '../styles/control-center-premium.css';

type Candidate = {
  id: string;
  name: string;
  sku: string | null;
  businessLine: string;
  sourceReference: string;
};
const labels = {
  name: 'Nombre comercial oficial',
  brand: 'Marca',
  manufacturer: 'Fabricante',
  reference: 'Referencia del fabricante',
  gtin: 'GTIN verificado',
  variant: 'Variante y presentación',
  description: 'Descripción y atributos',
  supplier: 'Proveedor y procedencia',
};

export function ProductMasterLabPage() {
  const pilots = useLocalLabData();
  const [loadError, setLoadError] = useState('');
  const [parameters] = useSearchParams();
  const initialPilot =
    pilots.products.find((p) => p.sku === parameters.get('pilot')) ?? pilots.products[0];
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [source, setSource] = useState('Cargando fuente…');
  const [search, setSearch] = useState('');
  const [slots, setSlots] = useState({
    BEAUTY_CARE: pilots.products.find((p) => p.business_line === 'BEAUTY_CARE')?.id ?? '',
    STYLE: pilots.products.find((p) => p.business_line === 'STYLE')?.id ?? '',
  });
  const [active, setActive] = useState(initialPilot?.id ?? '');
  const reviewSwitch = useRef<() => boolean>(() => true);
  function selectProduct(id: string, line?: 'BEAUTY_CARE' | 'STYLE') {
    if (id === active || reviewSwitch.current()) {
      if (line) setSlots((previous) => ({ ...previous, [line]: id }));
      setActive(id);
      return true;
    }
    return false;
  }
  const [tab, setTab] = useState(parameters.has('pilot') ? 'master' : 'dashboard');
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        if (productsComposition.source !== 'supabase') throw new Error('NO_LIVE_SOURCE');
        const rows = await productsComposition.getProducts.execute(createGetProductsQuery());
        if (live) {
          setCandidates(
            rows.map((r) => ({ ...r, sourceReference: 'Product Master · lectura configurada' })),
          );
          setSource('Product Master · lectura configurada');
        }
      } catch {
        if (live) {
          setCandidates([
            ...pilots.products.map((p) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              businessLine: p.business_line,
              sourceReference: 'Lectura DEV ' + pilots.readAt,
            })),
          ]);
          setSource('Snapshot histórico de importación · pilotos leídos en DEV ' + pilots.readAt);
        }
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, [pilots]);
  useEffect(() => {
    setActive(pilots.products[0]?.id ?? '');
    setSlots({
      BEAUTY_CARE: pilots.products.find((p) => p.business_line === 'BEAUTY_CARE')?.id ?? '',
      STYLE: pilots.products.find((p) => p.business_line === 'STYLE')?.id ?? '',
    });
  }, [pilots]);
  const selected = candidates.find((p) => p.id === active);
  const historical = source.startsWith('Archivo local');
  return (
    <ProductMasterLabShell
      search={search}
      onSearch={setSearch}
      confirmLeave={() => reviewSwitch.current()}
    >
      <section className="stack pm2" data-view={tab}>
        <div className="pm2-viewbar">
          <nav className="pm2-tabs" aria-label="Vistas del laboratorio">
            {[
              ['dashboard', 'Inicio'],
              ['master', 'Product Master'],
              ['media', 'Product Master · Media'],
            ].map(([key, title]) => (
              <button key={key} aria-pressed={tab === key} onClick={() => setTab(key!)}>
                {title}
              </button>
            ))}
          </nav>
          <div role="note" aria-label="Estado real del laboratorio" className="pm2-status">
            <span>
              <i className="pm2-dot" />
              Ensayo local · <strong>Persistencia remota:</strong> NOT TESTED
            </span>
            <details>
              <summary>Estado y procedencia</summary>
              <div className="pm2-status-detail">
                <div className="pm2-panel">
                  <label>
                    Archivo local de ensayo (JSON)
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file || !reviewSwitch.current()) return;
                        try {
                          if (file.size > 2_000_000) throw new Error('SIZE');
                          loadLocalLabData(await file.text());
                          setLoadError('');
                        } catch {
                          setLoadError('Archivo local inválido. Se conserva el ensayo anterior.');
                        } finally {
                          event.target.value = '';
                        }
                      }}
                    />
                  </label>
                  <p>
                    Entrada explícita en memoria · no se envía ni publica. Imágenes requieren
                    autorización de derechos.
                  </p>
                  <button
                    onClick={() => {
                      if (reviewSwitch.current()) clearLocalLabData();
                    }}
                  >
                    Cerrar ensayo local
                  </button>
                  <p role="alert">{loadError}</p>
                </div>

                <p>
                  <strong>Procedencia de esta sesión:</strong> {source}; configuración efectiva DEV
                  no verificada
                </p>
                <p>
                  <strong>Investigación automática de imágenes:</strong> proveedor no conectado
                </p>
                <p>
                  <strong>Derechos comerciales:</strong> pendientes de verificación
                </p>
                <p>
                  Lens sin motor visual acreditado. HTTPS comercial bloqueado. Sin escrituras
                  remotas. {source}. Autenticación y capacidades conservan la configuración
                  existente.
                </p>
              </div>
            </details>
          </div>
        </div>
        <div hidden={tab !== 'dashboard'} className="pm2-dashboard">
          <div className="pm2-dashboard-main">
            <section className="pm2-hero">
              <div className="pm2-hero-copy">
                <span className="pm2-kicker">LIHEN.CO | Beauty Care • Style</span>
                <h2>
                  La belleza está
                  <br />
                  en cada detalle.
                </h2>
                <div className="pm2-hero-inset">
                  <strong>Un catálogo a tu altura</strong>
                  <p>
                    Identidad, variantes e imágenes
                    <br />
                    con una historia verificable.
                  </p>
                  <button onClick={() => setTab('master')}>
                    Explorar mis productos <LabIcon name="arrow" />
                  </button>
                </div>
              </div>
              <PremiumCosmeticArtwork />
              <span className="pm2-hero-note">Ilustración original · ensayo local</span>
            </section>
            <div className="pm2-section-heading">
              <div>
                <span className="pm2-kicker">Tu selección de ensayo</span>
                <h2>Productos protagonistas</h2>
              </div>
              <span className="pm2-pill">2 pilotos · lectura DEV</span>
            </div>
            <div className="pm2-product-grid">
              {pilots.products.length === 0 &&
                ['Beauty Care', 'Style'].map((line) => (
                  <article className="pm2-product-card" key={line}>
                    <div className="pm2-product-visual">
                      <span>SIN DATOS</span>
                    </div>
                    <h3>{line}</h3>
                    <p>Sin selección local cargada</p>
                  </article>
                ))}
              {pilots.products
                .filter(
                  (p) =>
                    !search ||
                    [p.name, p.sku].some((v) => v.toLowerCase().includes(search.toLowerCase())),
                )
                .map((p, index) => (
                  <article className={`pm2-product-card pm2-product-card--${index}`} key={p.id}>
                    <button
                      className="pm2-product-visual"
                      onClick={() => {
                        if (selectProduct(p.id)) setTab('master');
                      }}
                      aria-label={`Abrir ${p.sku}`}
                    >
                      <span className="pm2-product-watermark">
                        {index === 0 ? 'BEAUTY' : 'STYLE'}
                      </span>
                      <img src={p.images[0]?.url} alt={p.name} />
                      <span className="pm2-edit-icon">
                        <LabIcon name="arrow" />
                      </span>
                    </button>
                    <div className="pm2-product-caption">
                      <span className="pm2-kicker">{index === 0 ? 'Beauty Care' : 'Style'}</span>
                      <h3>{p.name}</h3>
                      <div>
                        <strong>
                          {p.sale_price === null
                            ? 'SIN DATOS'
                            : new Intl.NumberFormat('es-CO', {
                                style: 'currency',
                                currency: 'COP',
                                maximumFractionDigits: 0,
                              }).format(Number(p.sale_price))}
                        </strong>
                        <span>{p.sku}</span>
                      </div>
                      <small>Precio consultado · derechos de imagen pendientes</small>
                    </div>
                  </article>
                ))}
            </div>
          </div>
          <aside className="pm2-dashboard-aside">
            <section className="pm2-panel pm2-analytics">
              <h2>Tu catálogo, en revisión</h2>
              <div
                className="pm2-empty-donut"
                role="img"
                aria-label="Sin gráfico de demanda: no hay datos atribuibles a variantes"
              >
                <span>
                  <strong>SIN DATOS</strong>
                  <small>Demanda por variante</small>
                </span>
              </div>
              <div className="pm2-legend">
                <span>
                  <i />
                  Beauty Care
                </span>
                <span>
                  <i />
                  Style
                </span>
              </div>
              <p>No hay registros atribuibles a un tono o talla. No calculamos porcentajes.</p>
            </section>
            <h2 className="pm2-aside-title">Resumen del ensayo</h2>
            {[
              ['bag', 'Productos piloto', '2', 'Lectura DEV · no es el total del catálogo'],
              ['box', 'Inventario disponible', '0', 'BC-20550: 0 · ST-019: 0'],
              [
                'book',
                'Imágenes registradas',
                '10',
                '1 Beauty Care · 9 Style; derechos pendientes',
              ],
            ].map(([icon, title, value, caption]) => (
              <section className="pm2-panel pm2-metric" key={title}>
                <span className="pm2-metric-icon">
                  <LabIcon name={icon!} />
                </span>
                <div>
                  <small>{title}</small>
                  <strong>{value}</strong>
                  <p>{caption}</p>
                </div>
              </section>
            ))}
            <p className="pm2-read-date">
              Lectura DEV:{' '}
              {pilots.readAt
                ? new Date(pilots.readAt).toLocaleDateString('es-CO', {
                    timeZone: 'America/Bogota',
                  })
                : 'SIN DATOS'}
              . Sin cambios comerciales.
            </p>
          </aside>
        </div>
        <div hidden={tab === 'dashboard'} className="pm2-product-workspace">
          <div className="pm2-product-switch">
            <div>
              <span className="pm2-kicker">PRODUCT MASTER 2.0</span>
              <h2>
                {tab === 'media' ? 'Tu estudio de imágenes' : 'Cada producto, bien identificado'}
              </h2>
            </div>
            <div className="pm2-switch-buttons">
              {(['BEAUTY_CARE', 'STYLE'] as const).map((line) => (
                <button
                  key={line}
                  aria-pressed={active === slots[line]}
                  onClick={() => selectProduct(slots[line])}
                >
                  {line === 'STYLE' ? 'Revisar Style' : 'Revisar Beauty Care'}
                </button>
              ))}
              <details>
                <summary>Elegir otro candidato</summary>
                <div className="pm2-candidate-picker">
                  {(['BEAUTY_CARE', 'STYLE'] as const).map((line) => (
                    <label key={line}>
                      {line === 'STYLE' ? 'Style' : 'Beauty Care'}
                      <select
                        aria-label={`Candidato ${line === 'STYLE' ? 'Style' : 'Beauty Care'}`}
                        value={slots[line]}
                        onChange={(e) => selectProduct(e.target.value, line)}
                      >
                        <option value="">Seleccionar con evidencia</option>
                        {candidates
                          .filter(
                            (p) =>
                              p.businessLine === line &&
                              (p.id === slots[line] ||
                                [p.name, p.sku, p.id].some((v) =>
                                  v?.toLowerCase().includes(search.toLowerCase()),
                                )),
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {p.sku}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                  <small>
                    Los demás candidatos proceden del snapshot histórico; requieren validar
                    vigencia.
                  </small>
                </div>
              </details>
            </div>
          </div>
          {selected ? (
            <ProductReview
              key={selected.id}
              candidate={selected}
              historical={historical}
              reviewSwitch={reviewSwitch}
              media={tab === 'media'}
            />
          ) : (
            <div className="pm2-panel">
              SIN DATOS · selecciona un candidato de una fuente disponible para comenzar.
            </div>
          )}
        </div>
      </section>
    </ProductMasterLabShell>
  );
}

function ProductReview({
  candidate,
  historical,
  media,
  reviewSwitch,
}: {
  candidate: Candidate;
  historical: boolean;
  media: boolean;
  reviewSwitch: React.MutableRefObject<() => boolean>;
}) {
  const auth = useAuth();
  const pilots = useLocalLabData();
  const pilot = pilots.products.find((p) => p.id === candidate.id);
  const pilotImages: ProductImageDTO[] = (pilot?.images ?? []).map((i, index) => ({
    id: i.id,
    productId: candidate.id,
    publicUrl: i.url,
    altText: i.alt,
    isMain: i.isMain,
    sortOrder: index,
    sourceType: i.sourceType as ProductImageDTO['sourceType'],
  }));
  const baseline = identityBaseline(candidate);
  const [proposal, setProposal] = useState<IdentityProposal>(() => ({
    productId: candidate.id,
    baseline,
    values: {
      name: '',
      brand: '',
      manufacturer: '',
      reference: '',
      gtin: '',
      variant: '',
      description: '',
      supplier: '',
    },
    sourceUrl: '',
    sourceKind: 'BRAND',
    evidence: '',
    checkedAt: new Date().toISOString().slice(0, 10),
    exactVariant: false,
    discardedVariants: '',
    reviewer: '',
  }));
  const [review, setReview] = useState<LocalReview | undefined>();
  const [localCandidates, setLocalCandidates] = useState<ProductMasterCandidates | null>(null);
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [images, setImages] = useState<readonly ProductImageDTO[]>(pilotImages);
  const [readable, setReadable] = useState(Boolean(pilot));
  const [imageLoadState, setImageLoadState] = useState<ProjectionImageLoadState>(
    !historical && productsComposition.canReadImages ? 'loading' : 'unavailable',
  );
  const [notice, setNotice] = useState('');
  const [reference, setReference] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [treatmentConsent, setTreatmentConsent] = useState(false);
  const [visualBusy, setVisualBusy] = useState(false);
  const visualInFlight = useRef(false);
  const [visualObservations, setVisualObservations] = useState<readonly string[]>([]);
  const [visualBinding, setVisualBinding] = useState<unknown>(null);
  const [manual, setManual] = useState('');
  const [rights, setRights] = useState(false);
  const rightsRef = useRef(false);
  const referenceRef = useRef('');
  const manualRef = useRef('');
  const generation = useRef(0);
  const [dirty, setDirty] = useState(false);
  const [familyDirty, setFamilyDirty] = useState(false);
  useUnsavedChanges(dirty || familyDirty);
  useEffect(() => {
    reviewSwitch.current = () =>
      (!dirty && !familyDirty) ||
      window.confirm('Hay cambios sin exportar. ¿Descartar este expediente local?');
    return () => {
      reviewSwitch.current = () => true;
    };
  }, [dirty, familyDirty, reviewSwitch]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || familyDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, familyDirty]);
  useEffect(() => {
    let live = true;
    setImageLoadState(!historical && productsComposition.canReadImages ? 'loading' : 'unavailable');
    if (!historical) {
      void productsComposition.getProductById
        .execute(createGetProductByIdQuery(candidate.id))
        .then((p) => {
          if (live) setProduct(p);
        })
        .catch(() => {
          if (live) setNotice('Detalle no disponible. No se asumen precio ni inventario.');
        });
      if (productsComposition.canReadImages)
        void productsComposition.getProductImages
          .execute(createGetProductImagesQuery(candidate.id))
          .then((rows) => {
            if (live) {
              setImages(rows);
              setReadable(true);
              setImageLoadState('loaded');
            }
          })
          .catch(() => {
            if (live) {
              setImageLoadState('error');
              setNotice('Galería no disponible; cupos sin verificar.');
            }
          });
    }
    return () => {
      live = false;
      generation.current++;
      URL.revokeObjectURL(referenceRef.current);
      URL.revokeObjectURL(manualRef.current);
    };
  }, [candidate.id, historical]);
  function change(next: IdentityProposal) {
    setProposal(next);
    setReview((previous) =>
      previous
        ? {
            ...previous,
            proposal: next,
            status: 'PENDING',
            events: [
              ...previous.events,
              {
                at: new Date().toISOString(),
                action: 'EDITED_REQUIRES_REVIEW',
                reviewer: next.reviewer,
              },
            ],
          }
        : undefined,
    );
    setDirty(true);
    setNotice('');
  }
  function decide(approve: boolean) {
    try {
      setReview(reviewProposal(proposal, approve, review));
      setDirty(true);
      setNotice(
        approve
          ? 'Aprobación de ensayo registrada. No autoriza actualizar Product Master ni publicar.'
          : 'Propuesta rechazada en ensayo.',
      );
    } catch {
      setNotice(proposalIssues(proposal).join(' '));
    }
  }
  function download() {
    const body = {
      ...(review ?? { version: 1, proposal, status: 'PENDING', events: [] }),
      ...(localCandidates
        ? { productCandidates: exportProductMasterCandidates(localCandidates) }
        : {}),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-master-${candidate.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDirty(false);
    setNotice('Expediente exportado. Las fotografías locales no se incluyen.');
  }
  async function recover(file: File) {
    if (file.size > 100000) {
      setNotice('Archivo demasiado grande.');
      return;
    }
    if (dirty && !window.confirm('¿Reemplazar el expediente local pendiente?')) return;
    const current = generation.current;
    try {
      const raw = await file.text();
      const result = recoverReview(raw, candidate.id, baseline);
      const imported = JSON.parse(raw).productCandidates;
      const candidates =
        imported === undefined
          ? null
          : recoverProductMasterCandidates(JSON.stringify(imported), currentProduct, images);
      if (current !== generation.current) return;
      setProposal(result.proposal);
      setReview(result);
      setLocalCandidates(candidates);
      setDirty(false);
      setNotice('Expediente recuperado; requiere una nueva revisión humana.');
    } catch {
      if (current === generation.current)
        setNotice('Archivo inválido, de otro producto o con identidad desactualizada.');
    }
  }
  const [detailTab, setDetailTab] = useState('identity');
  const currentProduct = {
    id: candidate.id,
    name: product?.name ?? candidate.name,
    sku: product?.sku ?? candidate.sku,
    businessLine: product?.businessLine ?? candidate.businessLine,
  };
  const projection = buildProductMasterProjection(currentProduct, {
    nameReview: localCandidates?.nameReview ?? null,
    variants: localCandidates?.variants ?? [],
    variantMedia: localCandidates?.variantMedia ?? [],
    images,
  });
  return (
    <article className="pm2-review" data-media={media} data-detail={detailTab}>
      <ProductProjectionReadOnly
        projection={projection}
        imageLoadState={imageLoadState}
        candidatesIntegrated={localCandidates !== null}
      />
      <ProductMasterCandidateReview
        product={currentProduct}
        images={projection.images.references}
        candidates={localCandidates}
        onDirty={() => setDirty(true)}
        onChange={(next) => {
          setLocalCandidates(next);
          setDirty(true);
        }}
      />
      <section className="pm2-panel">
        <h3>Análisis visual de una imagen DEV existente</h3>
        <p>
          Preparado localmente; proveedor servidor y despliegue no verificados. No repite la prueba
          Groq cerrada automáticamente. Cada acción requiere consentimiento y confirmación.
        </p>
        <label>
          <input
            type="checkbox"
            checked={treatmentConsent}
            disabled={visualBusy}
            onChange={(event) => setTreatmentConsent(event.target.checked)}
          />
          Autorizo el tratamiento externo de esta fotografía por el proveedor visual configurado. No
          enviar información confidencial.
        </label>
        {images.map((image) => (
          <button
            key={image.id}
            disabled={
              !isPilotProduct(candidate) ||
              imageLoadState !== 'loaded' ||
              !treatmentConsent ||
              visualBusy
            }
            onClick={async () => {
              if (
                visualInFlight.current ||
                !treatmentConsent ||
                !window.confirm(
                  '¿Ejecutar UNA llamada visual real con esta imagen DEV, sin búsqueda ni reintentos?',
                )
              )
                return;
              visualInFlight.current = true;
              setVisualBusy(true);
              setVisualObservations([]);
              setVisualBinding(null);
              try {
                const report = await analyzeExistingProductPhoto(
                  candidate.id,
                  image.id,
                  treatmentConsent,
                );
                setNotice(report.messages.join(' / '));
                if (report.status === 'SUCCESS') {
                  setVisualObservations(report.data?.[0]?.observations ?? []);
                  setVisualBinding(report.data?.[0]?.attributes.provenance ?? null);
                }
              } catch {
                setNotice('BLOCKED: análisis no confirmado. Sin reintentos automáticos.');
              } finally {
                visualInFlight.current = false;
                setVisualBusy(false);
              }
            }}
          >
            Analizar imagen existente · {image.id} · una llamada
          </button>
        ))}
        {visualBinding !== null && <pre>{JSON.stringify(visualBinding, null, 2)}</pre>}
        <p>
          Identidad y derechos no confirmados; revisión humana obligatoria. La galería existente se
          conserva.
        </p>
      </section>
      <div className="pm2-detail-layout" hidden={media}>
        <aside className="pm2-panel pm2-product-portrait">
          <div className="pm2-portrait-stage">
            <img
              src={images.find((i) => i.isMain)?.publicUrl ?? pilot?.images[0]?.url}
              alt={candidate.name}
            />
          </div>
          <span className="pm2-kicker">
            {candidate.businessLine === 'STYLE' ? 'Style' : 'Beauty Care'}
          </span>
          <h2>{candidate.name}</h2>
          <p>
            {candidate.sku} · {pilot?.canonical_brand ?? 'Marca pendiente'}
          </p>
          <span className="pm2-pill">Variante exacta sin confirmar</span>
          <div className="pm2-mini-facts">
            <span>Fotografía general registrada</span>
            <small>Identidad y derechos pendientes de revisión.</small>
          </div>
          <details>
            <summary>Identidad durable y procedencia</summary>
            <p>{candidate.id}</p>
            <p>{candidate.sourceReference}</p>
            <p>
              Proveedor:{' '}
              {pilot?.suppliers.map((p) => p.name + ' / ' + p.reference).join(', ') ||
                'Sin vínculo registrado'}
              .
            </p>
          </details>
        </aside>
        <div className="pm2-detail-content">
          <nav className="pm2-detail-tabs" aria-label="Paneles del producto">
            {[
              ['identity', 'Identidad'],
              ['info', 'Información'],
              ['stock', 'Inventario'],
              ['price', 'Precio'],
              ['history', 'Historial'],
              ['intelligence', 'Inteligencia'],
              ['variants', 'Variantes y demanda'],
            ].map(([key, title]) => (
              <button key={key} aria-pressed={detailTab === key} onClick={() => setDetailTab(key!)}>
                {title}
              </button>
            ))}
          </nav>
          <section
            className="pm2-panel pm2-identity-fields"
            hidden={media || detailTab !== 'identity'}
          >
            <h3>Comparar identidad y variante</h3>
            <p>
              Los campos vacíos significan pendiente de evidencia. SKU y código interno no prueban
              la referencia del fabricante.
            </p>
            <div className="pm2-fields">
              {MASTER_FIELDS.map((field) => (
                <label key={field}>
                  {labels[field]}
                  <input
                    value={proposal.values[field]}
                    onChange={(e) =>
                      change({
                        ...proposal,
                        values: { ...proposal.values, [field]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="pm2-compare">
              <div>
                <small>Actual</small>
                <strong>{candidate.name}</strong>
              </div>
              <div>
                <small>Propuesta sin aplicar</small>
                <strong>{proposal.values.name || 'Pendiente'}</strong>
                <span>{proposal.values.variant || 'Variante pendiente'}</span>
              </div>
            </div>
          </section>{' '}
          <section
            className="pm2-panel pm2-source-review"
            hidden={media || detailTab !== 'intelligence'}
          >
            <h3>Revisión de fuente oficial</h3>
            <label>
              Fuente original HTTPS
              <input
                type="url"
                value={proposal.sourceUrl}
                onChange={(e) => change({ ...proposal, sourceUrl: e.target.value })}
              />
            </label>
            <label>
              Autoridad declarada
              <select
                value={proposal.sourceKind}
                onChange={(e) =>
                  change({
                    ...proposal,
                    sourceKind: e.target.value as IdentityProposal['sourceKind'],
                  })
                }
              >
                <option value="BRAND">Marca</option>
                <option value="MANUFACTURER">Fabricante</option>
                <option value="AUTHORIZED_DISTRIBUTOR">Distribuidor autorizado</option>
              </select>
            </label>
            <label>
              Fecha de consulta
              <input
                type="date"
                value={proposal.checkedAt}
                onChange={(e) => change({ ...proposal, checkedAt: e.target.value })}
              />
            </label>
            <label>
              Evidencia, autoridad de la fuente y discrepancias
              <textarea
                value={proposal.evidence}
                onChange={(e) => change({ ...proposal, evidence: e.target.value })}
              />
            </label>
            <label>
              Variantes descartadas
              <textarea
                value={proposal.discardedVariants}
                onChange={(e) => change({ ...proposal, discardedVariants: e.target.value })}
              />
            </label>
            <label className="pm2-check">
              <input
                type="checkbox"
                checked={proposal.exactVariant}
                onChange={(e) => change({ ...proposal, exactVariant: e.target.checked })}
              />
              Revisé evidencia oficial de la variante exacta
            </label>
            <p>
              Confianza:{' '}
              {proposalIssues(proposal).length
                ? 'Evidencia incompleta · sin puntuación automática'
                : 'Revisión manual documentada · autoridad declarada, sin verificación automática'}
            </p>
            <label>
              Persona revisora del ensayo
              <input
                value={proposal.reviewer}
                onChange={(e) => change({ ...proposal, reviewer: e.target.value })}
              />
            </label>
            <div className="pm2-actions">
              <button onClick={() => decide(true)}>Aprobar en ensayo</button>
              <button onClick={() => decide(false)}>Rechazar propuesta</button>
              <button onClick={download}>Exportar expediente</button>
            </div>
            <label>
              Recuperar expediente JSON
              <input
                className="pm2-file-input"
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void recover(file);
                  e.target.value = '';
                }}
              />
            </label>
            <p>Estado: {review?.status ?? 'PENDING'} · aprobación comercial pendiente.</p>
            {review?.events.map((event, i) => (
              <p key={i}>
                {event.at} · {event.action} · {event.reviewer}
              </p>
            ))}
          </section>
          <section className="pm2-panel" hidden={media || detailTab !== 'info'}>
            <h3>Información registrada</h3>
            <dl className="pm2-facts">
              <div>
                <dt>Marca</dt>
                <dd>{pilot?.canonical_brand ?? 'Sin marca verificada'}</dd>
              </div>
              <div>
                <dt>Categoría</dt>
                <dd>{pilot?.category ?? 'Sin asignar'}</dd>
              </div>
              <div>
                <dt>Variante y presentación</dt>
                <dd>Sin variante exacta registrada</dd>
              </div>
              <div>
                <dt>Proveedor</dt>
                <dd>
                  {pilot?.suppliers.map((p) => p.name + ' / ' + p.reference).join(', ') ||
                    'Sin vínculo registrado'}
                </dd>
              </div>
            </dl>
            <p>La información consultada no certifica identidad oficial ni autoriza cambios.</p>
          </section>
          <section className="pm2-panel" hidden={media || detailTab !== 'stock'}>
            <h3>Inventario del producto</h3>
            <div className="pm2-info-metrics">
              {[
                ['Disponible', pilot?.inventory?.available],
                ['En mano', pilot?.inventory?.onHand],
                ['Reservado', pilot?.inventory?.reserved],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <small>{label}</small>
                  <strong>{value ?? 'SIN DATOS'}</strong>
                </div>
              ))}
            </div>
            <p>
              Ensayo local. Inventario por variante: SIN DATOS. No se distribuyen existencias entre
              tonos o tallas.
            </p>
          </section>
          <section className="pm2-panel" hidden={media || detailTab !== 'price'}>
            <h3>Precio consultado</h3>
            <strong className="pm2-price">
              {product
                ? new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: product.salePrice.currency,
                  }).format(product.salePrice.amount)
                : pilot && pilot.sale_price !== null
                  ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(
                      Number(pilot.sale_price),
                    )
                  : 'SIN DATOS'}
            </strong>
            <p>Lectura {pilots.readAt}. Precio por variante o compartido: NO VERIFICADO.</p>
            <button disabled>Cambios de precio bloqueados en el ensayo</button>
          </section>
          <section className="pm2-panel" hidden={media || detailTab !== 'history'}>
            <h3>Historial y auditoría</h3>
            <div className="pm2-empty-chart">
              <LabIcon name="chart" />
              <strong>
                {pilot && pilot.price_history.length === 0
                  ? 'Sin cambios de precio registrados'
                  : 'Historial no consultado'}
              </strong>
              <span>No se fabrican registros históricos.</span>
            </div>
            <p>Decisión local: {review?.status ?? 'PENDING'}. Aprobación comercial pendiente.</p>
            {review?.events.map((e, i) => (
              <p key={i}>
                {e.at} · {e.action} · {e.reviewer}
              </p>
            ))}
          </section>
        </div>
      </div>
      <div className="pm2-media-workspace" hidden={!media}>
        <div className="pm2-media-heading">
          <div>
            <h2>{candidate.name}</h2>
            <p>
              {candidate.sku} · {pilot?.canonical_brand ?? 'Marca pendiente'} · identidad exacta sin
              confirmar
            </p>
          </div>
          <span className="pm2-pill">HTTPS bloqueado · sin incorporación</span>
        </div>
        <div className="pm2-media-columns">
          {' '}
          <section className="pm2-panel pm2-reference" hidden={!media}>
            <h3>Comenzar con una fotografía</h3>
            <p className="pm2-muted">
              Una sola foto es suficiente para iniciar la revisión manual.
            </p>
            <label>
              Fotografía de referencia
              <input
                className="pm2-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (
                    !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ||
                    f.size > 12 * 1024 * 1024
                  ) {
                    setNotice('Utiliza JPG, PNG o WebP hasta 12 MB.');
                    return;
                  }
                  URL.revokeObjectURL(referenceRef.current);
                  referenceRef.current = URL.createObjectURL(f);
                  setReference(referenceRef.current);
                  setReferenceFile(f);
                  setTreatmentConsent(false);
                  setVisualObservations([]);
                  setVisualBinding(null);
                }}
              />
            </label>
            {!reference && (
              <div className="pm2-reference-empty">
                <LabIcon name="spark" />
                <span>Tu investigación empieza con una imagen</span>
                <small>JPG, PNG o WebP · hasta 12 MB</small>
              </div>
            )}
            {reference && (
              <img
                className="pm2-photo"
                src={reference}
                alt="Referencia local pendiente de identificación manual"
              />
            )}
            <div className="pm2-lens-state">
              <span className="pm2-dot" />
              Lens y búsqueda automática sin conectar
            </div>
            <details>
              <summary>Etapas y límites de investigación</summary>
              <p>
                Referencia: {reference ? 'recibida para revisión manual' : 'pendiente'}.
                Coincidencia y confianza sin calcular. Identidad exacta y licencia requieren
                revisión humana. El analisis visual requiere autorizacion; la busqueda externa sigue
                deshabilitada.
              </p>
            </details>
            <label>
              <input
                type="checkbox"
                checked={treatmentConsent}
                disabled={visualBusy}
                onChange={(e) => setTreatmentConsent(e.target.checked)}
              />
              Autorizo el tratamiento de esta fotografía por el proveedor visual configurado. No
              enviar datos personales o confidenciales.
            </label>
            <button
              disabled={
                !isPilotProduct(candidate) || !referenceFile || !treatmentConsent || visualBusy
              }
              onClick={async () => {
                if (visualInFlight.current || !referenceFile || !treatmentConsent) return;
                visualInFlight.current = true;
                setVisualBusy(true);
                setVisualObservations([]);
                setVisualBinding(null);
                const currentReference = referenceRef.current;
                try {
                  const report = await analyzeProductPhoto(
                    candidate.id,
                    referenceFile,
                    treatmentConsent,
                  );
                  if (currentReference !== referenceRef.current) return;
                  setNotice(report.messages.join(' / '));
                  if (report.status === 'SUCCESS')
                    setVisualObservations(report.data?.[0]?.observations ?? []);
                } catch {
                  setNotice('BLOCKED: analisis visual no disponible. Sin reintento automatico.');
                } finally {
                  visualInFlight.current = false;
                  setVisualBusy(false);
                }
              }}
            >
              {visualBusy ? 'Analizando...' : 'Analizar una foto / CANDIDATE'}
            </button>
            <p>
              Identidad no confirmada / derechos UNKNOWN / requiere aprobacion humana / busqueda
              externa deshabilitada.
            </p>
            <ul>
              {visualObservations.map((observation, i) => (
                <li key={i}>CANDIDATE: {observation}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      <div className="pm2-family-host" hidden={!media && detailTab !== 'variants'}>
        <ProductFamilyLab
          productId={candidate.id}
          sku={candidate.sku}
          onDirty={setFamilyDirty}
          media={media}
        />
      </div>
      <section className="pm2-panel pm2-existing-gallery" hidden={!media}>
        <h3>Galería visual y derechos</h3>
        <p>
          Contrato existente: {LIHEN_MAX_IMAGES} imágenes totales, {LIHEN_MANUAL_BATCH_LIMIT} por
          lote manual. Este ensayo no sustituye imágenes existentes.
        </p>
        <div className="pm2-gallery pm2-existing-grid">
          {images.map((image) => (
            <figure key={image.id}>
              <img src={image.publicUrl} alt={image.altText || 'Imagen existente sin revisar'} />
              <figcaption>Existente · identidad y derechos pendientes de revisión</figcaption>
            </figure>
          ))}
        </div>
        {!readable && <p>Galería persistida: no consultada o lectura no disponible.</p>}
        <details className="pm2-manual">
          <summary>Ensayar una carga WebP autorizada</summary>
          <label className="pm2-check">
            <input
              type="checkbox"
              checked={rights}
              onChange={(e) => {
                setRights(e.target.checked);
                rightsRef.current = e.target.checked;
                if (!e.target.checked) {
                  URL.revokeObjectURL(manualRef.current);
                  manualRef.current = '';
                  setManual('');
                }
              }}
            />
            Declaro autorización para ensayar con esta imagen manual
          </label>
          <label>
            Ensayar carga WebP local
            <input
              disabled={!rights}
              className="pm2-file-input"
              type="file"
              accept="image/webp"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const current = generation.current;
                try {
                  if (f.type !== 'image/webp') throw new Error();
                  const optimized = await optimizeProductImage(f);
                  if (current !== generation.current || !rightsRef.current) return;
                  URL.revokeObjectURL(manualRef.current);
                  manualRef.current = URL.createObjectURL(optimized.file);
                  setManual(manualRef.current);
                  setNotice('WebP validado en memoria. Sin carga a Storage ni estado publicable.');
                } catch {
                  if (current === generation.current)
                    setNotice('El archivo no es un WebP válido para el ensayo.');
                }
              }}
            />
          </label>
          {manual && (
            <img
              className="pm2-photo"
              src={manual}
              alt="WebP local validado para ensayo sin publicar"
            />
          )}
        </details>
        <p>
          Importación HTTPS: bloqueada. La aprobación de este expediente no concede permiso de
          importación.
        </p>
      </section>
      {product && (
        <details className="pm2-panel">
          <summary>Investigación de imágenes · contrato existente</summary>
          <VerifiedProductImagesPanel
            product={product}
            images={images}
            galleryReadable={readable}
            stagedCount={0}
            authorized={auth.authorized}
            userId={auth.user?.id}
          />
        </details>
      )}
      {!historical && (
        <nav className="pm2-links" aria-label="Relaciones del producto">
          <Link to={`/products/${candidate.id}`}>Datos e historial original</Link>
          <Link to={`/products/${candidate.id}/images`}>Carga autorizada existente</Link>
          <Link to="/inventory">Inventario</Link>
          <Link to="/suppliers">Proveedores</Link>
          <Link to="/catalogs">Catálogos</Link>
          <Link to="/content/social">Contenido editorial</Link>
        </nav>
      )}
      <p className="pm2-operation-message" role="status" aria-live="polite">
        {notice}
      </p>
    </article>
  );
}
