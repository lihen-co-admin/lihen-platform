import { useState } from 'react';
import {
  type buildProductMasterProjection,
  type identityBaseline,
  type ProductMasterCandidates,
  recoverProductMasterCandidates,
  canApproveCommercialName,
  reviewCommercialNameProposal,
  identityBaseline as currentBaseline,
} from '../domain/product-master-lab';
import { useLocalLabData } from '../domain/product-master-lab-data';
import {
  canApproveVariantMedia,
  mediaForVariant,
  variantDemand,
  type VariantScope,
  type VariantMedia,
} from '../domain/product-variant-demand';

export type ProjectionImageLoadState = 'loading' | 'error' | 'unavailable' | 'loaded';

/** Presentation only: reuses the existing gallery without loading or approving references. */
export function ProductProjectionReadOnly({
  projection,
  imageLoadState,
  candidatesIntegrated = false,
}: {
  projection: ReturnType<typeof buildProductMasterProjection>;
  imageLoadState: ProjectionImageLoadState;
  candidatesIntegrated?: boolean;
}) {
  const imageStatus = {
    loading: 'Imágenes DEV: cargando.',
    error: 'Imágenes DEV: error de lectura; referencias visibles sin confirmar.',
    unavailable: 'Imágenes DEV: lectura no disponible; sin resultados confirmados.',
    loaded: projection.images.references.length
      ? `Imágenes DEV: disponibles (${projection.images.references.length}). Revisión pendiente.`
      : 'Imágenes DEV: lectura completada, sin resultados.',
  }[imageLoadState];
  const roles = projection.images.roles;
  return (
    <section className="pm2-panel" aria-label="Proyección candidata del producto">
      <h3>Producto candidato · solo lectura</h3>
      <p>ID permanente: {projection.product.id}</p>
      <p>Nombre vigente: {projection.name.currentName}</p>
      <p>
        Nombre candidato:{' '}
        {projection.name.recordedReview?.proposal.candidateName ?? 'Sin propuesta integrada'}
      </p>
      <p>
        Revisión histórica del nombre:{' '}
        {projection.name.recordedReview?.status ?? 'No integrada en esta vista'}
      </p>
      <p>
        Elegibilidad actual:{' '}
        {projection.name.eligible ? 'Elegible para revisión humana' : 'Pendiente'}. Sin aplicación
        comercial.
      </p>
      <p>
        {candidatesIntegrated
          ? 'Expediente candidato local integrado; no constituye aprobación comercial.'
          : 'Revisión independiente del nombre, variantes y vínculos de imágenes por variante: no integrados en esta vista; no descartados.'}
      </p>
      {projection.variants.map((variant) => (
        <details key={variant.evidence.sourceVariantId}>
          <summary>
            Referencia candidata: {variant.evidence.code ?? variant.evidence.sourceVariantId}
          </summary>
          <p>
            Fuente declarada: {variant.evidence.sourceUrl} · {variant.evidence.status}
          </p>
          <p>{JSON.stringify(variant.evidence.attributes)}</p>
          <p>
            Revisión: {variant.reviewStatus}. Vínculos explícitos: {variant.images.length}.
          </p>
          <p>{variant.uncertainties.join(' · ')}</p>
        </details>
      ))}
      <p>
        Variantes: {projection.variants.length ? 'Referencias candidatas' : 'Sin confirmar'}.
        Aprobación humana pendiente.
      </p>
      <p role="status">{imageStatus}</p>
      <p>
        Se reutiliza la galería existente. Disponibilidad no confirma identidad, procedencia ni
        derechos.
      </p>
      <dl>
        <dt>Principal catálogo</dt>
        <dd>{roles.catalogPrimary ?? 'Pendiente'}</dd>
        <dt>Principal web</dt>
        <dd>{roles.webPrimary ?? 'Pendiente'}</dd>
        <dt>Galería</dt>
        <dd>{roles.gallery.join(', ') || 'Pendiente de asignación'}</dd>
        <dt>Foto grupal</dt>
        <dd>{roles.groupPhoto.join(', ') || 'Pendiente'}</dd>
        <dt>Imágenes por variante</dt>
        <dd>{Object.keys(roles.byVariant).length ? 'Vínculos candidatos' : 'Pendientes'}</dd>
      </dl>
      <details>
        <summary>Bloqueos pendientes</summary>
        <ul>
          {projection.blockers.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function ProductMasterCandidateReview({
  product,
  images,
  candidates,
  onChange,
  onDirty,
}: {
  product: Parameters<typeof identityBaseline>[0];
  images: ReturnType<typeof buildProductMasterProjection>['images']['references'];
  candidates: ProductMasterCandidates | null;
  onChange: (next: ProductMasterCandidates) => void;
  onDirty: () => void;
}) {
  const [raw, setRaw] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [message, setMessage] = useState('');
  const name = candidates?.nameReview;
  const identityConflictMissing =
    product.sku === 'BC-20550' && !name?.proposal.identificationConflicts.length;
  const eligible = Boolean(
    name && !identityConflictMissing && canApproveCommercialName(name.proposal, product),
  );
  return (
    <section className="pm2-panel">
      <h3>Expediente candidato local · revisión independiente</h3>
      <p>
        Importar propuestas explícitas de nombre, variantes y usos de imágenes existentes. No
        importa artefactos privados ni consulta IA. IDs y nombre comercial permanecen intactos. Las
        ocho observaciones anteriores siguen sin vínculo confirmado.
      </p>
      <label>
        Expediente JSON
        <textarea
          aria-label="Expediente candidato JSON"
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            onDirty();
          }}
        />
      </label>
      <button
        onClick={() => {
          try {
            onChange(recoverProductMasterCandidates(raw, product, images));
            setMessage(
              'CANDIDATE: importado para revisión local; derechos y coincidencias sin confirmar.',
            );
          } catch {
            setMessage(
              'Importación bloqueada: formato, baseline, producto, fuente o vínculo no válido.',
            );
          }
        }}
      >
        Revisar expediente local
      </button>
      <p>
        El expediente exige productId, baseline, nameProposal (o null), variants, variantMedia e
        imageRoleProposals. No se generan tonos, códigos ni propuestas automáticamente.
      </p>
      <button
        onClick={() => {
          setRaw(
            JSON.stringify(
              {
                productId: product.id,
                baseline: currentBaseline(product),
                nameProposal: null,
                variants: [],
                variantMedia: [],
                imageRoleProposals: [],
              },
              null,
              2,
            ),
          );
          onDirty();
        }}
      >
        Preparar estructura vacía del producto actual
      </button>
      <label>
        Persona revisora del nombre
        <input
          value={reviewer}
          onChange={(event) => {
            setReviewer(event.target.value);
            onDirty();
          }}
        />
      </label>
      {identityConflictMissing && (
        <p>BC-20550: resolución trazable del conflicto de identidad pendiente.</p>
      )}
      <button
        disabled={!eligible || !reviewer.trim()}
        onClick={() => {
          if (!name || !candidates || !eligible) return;
          onChange({
            ...candidates,
            nameReview: reviewCommercialNameProposal(name.proposal, product, true, reviewer),
          });
          setMessage(
            'Revisión local del nombre registrada. Sin aplicación comercial ni aprobación de variantes o imágenes.',
          );
        }}
      >
        Aprobar nombre sólo en ensayo local
      </button>
      <p>Usos fotográficos propuestos; aprobación y derechos independientes, pendientes:</p>
      <ul>
        {candidates?.imageRoleProposals.map((role, index) => (
          <li key={index}>
            {role.role} · {role.imageId}
            {role.variantId ? ` · variante ${role.variantId}` : ''} · {role.evidence} · CANDIDATE
          </li>
        ))}
      </ul>
      <p role="status">{message}</p>
    </section>
  );
}

export function ProductFamilyLab({
  productId,
  sku,
  onDirty,
  media,
}: {
  productId: string;
  sku: string | null;
  onDirty: (dirty: boolean) => void;
  media: boolean;
}) {
  const data = useLocalLabData();
  const official = data.family ?? { productId: '', title: 'Familia SIN DATOS', sourceUrl: '', checkedAt: '', variants: [] };
  const beauty = official.productId === productId;
  const [variantId, setVariantId] = useState(beauty ? (official.variants[0]?.sourceVariantId ?? '') : '');
  const [reviewer, setReviewer] = useState('');
  const [rightsEvidence, setRightsEvidence] = useState('');
  const [exact, setExact] = useState(false);
  const [decisions, setDecisions] = useState<
    { variantId: string; action: string; at: string; sourceUrl: string; reviewer: string }[]
  >([]);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewOpen, setReviewOpen] = useState(false);
  const scope: VariantScope = { familyProductId: productId, variantId };
  const selected = official.variants.find((v) => v.sourceVariantId === variantId);
  const photos: VariantMedia[] = beauty
    ? official.variants
        .filter((v) => Boolean(v.imageUrl))
        .map((v) => ({
          familyProductId: productId,
          variantId: v.sourceVariantId,
          id: String(v.imageId),
          imageUrl: v.imageUrl,
          rights: 'UNVERIFIED',
          exactMatch: false,
        }))
    : [];
  const currentPhotos = mediaForVariant(scope, photos);
  const demand = variantDemand(
    scope,
    [],
    new Date().toISOString().slice(0, 10),
    new Date().toISOString().slice(0, 10),
  );
  function decide(action: string) {
    if (!reviewer.trim()) {
      setMessage('Identifica a la persona revisora.');
      return;
    }
    if (
      action === 'APPROVE' &&
      (!currentPhotos[0] || !canApproveVariantMedia(currentPhotos[0], rightsEvidence, exact))
    ) {
      setMessage(
        'Aprobación bloqueada: falta evidencia verificable de derechos y coincidencia exacta.',
      );
      return;
    }
    onDirty(true);
    setDecisions((previous) => [
      ...previous,
      { variantId, action, at: new Date().toISOString(), sourceUrl: official.sourceUrl, reviewer },
    ]);
    setMessage(
      action === 'REJECT'
        ? 'Candidata rechazada en este ensayo. No se altera la galería existente.'
        : 'Sustitución solicitada. Aporta una imagen autorizada en el ensayo WebP manual.',
    );
  }
  function exportDecisions() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ mode: 'LOCAL_REHEARSAL', productId, decisions }, null, 2)], {
        type: 'application/json',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `variant-media-review-${productId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onDirty(false);
  }
  return (
    <section className={`pm2-family pm2-panel${media ? ' pm2-family--media' : ''}`}>
      <span className="pm2-kicker">Familia comercial y variantes</span>
      <h3>{beauty ? official.title : 'Familia Style pendiente de fuente oficial'}</h3>
      <p className="pm2-family-status">
        {beauty
          ? 'Familia probable · 18 variantes oficiales en fuente · vínculo LIHEN pendiente'
          : 'Familia y variantes Style sin confirmar'}
      </p>
      {beauty ? (
        <>
          <div className="pm2-family-toolbar">
            <label>
              Presentación
              <select
                aria-label="Filtrar presentación"
                value={filter}
                onChange={(e) => {
                  const next = e.target.value;
                  setFilter(next);
                  const first = official.variants.find(
                    (v) => next === 'all' || v.title.endsWith(next),
                  );
                  if (first) setVariantId(first.sourceVariantId);
                  setRightsEvidence('');
                  setExact(false);
                  setReviewOpen(false);
                }}
              >
                <option value="all">Todas las presentaciones</option>
                <option value="30ml">30 ml</option>
                <option value="50ml">50 ml</option>
              </select>
            </label>
            <label>
              Verificación
              <select
                aria-label="Filtrar verificación"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="source">Oficiales en fuente</option>
                <option value="pending">Vínculo LIHEN pendiente</option>
                <option value="approved">Aprobadas comercialmente</option>
              </select>
            </label>
            <a href={official.sourceUrl} target="_blank" rel="noreferrer">
              Fuente oficial ↗
            </a>
          </div>
          <div className="pm2-variants" role="group" aria-label="Variantes documentadas">
            {official.variants
              .filter(
                (v) =>
                  (filter === 'all' || v.title.endsWith(filter)) && statusFilter !== 'approved',
              )
              .map((v) => (
                <button
                  key={v.sourceVariantId}
                  aria-pressed={variantId === v.sourceVariantId}
                  onClick={() => {
                    setVariantId(v.sourceVariantId);
                    setRightsEvidence('');
                    setExact(false);
                    setMessage('');
                    setReviewOpen(false);
                  }}
                >
                  {v.imageUrl ? (
                    <img
                      src={v.imageUrl}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      alt={`Tono documentado ${v.title}`}
                    />
                  ) : (
                    <span className="pm2-variant-no-photo">Sin imagen</span>
                  )}
                  <strong>{v.title}</strong>
                  <small>Oficial en fuente</small>
                  <small>{v.sku || 'Código no expuesto'}</small>
                  <span className="pm2-variant-pending">Vínculo pendiente</span>
                </button>
              ))}
          </div>
          {statusFilter === 'approved' && (
            <div className="pm2-empty-chart">
              <strong>Sin fotografías aprobadas comercialmente</strong>
              <span>No se ocultan candidatas: cambia el filtro para revisarlas.</span>
            </div>
          )}
          <article className="pm2-variant-detail" hidden={statusFilter === 'approved'}>
            <h4>Variante seleccionada: {selected?.title}</h4>
            <p className="pm2-variant-code">
              Código externo: {selected?.sku || 'No expuesto'} · derechos sin verificar
            </p>
            <div className="pm2-gallery">
              {currentPhotos.map((p) => (
                <figure key={p.id}>
                  <img
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    src={p.imageUrl}
                    alt={`Candidata oficial ${selected?.title}; derechos sin verificar`}
                  />
                  <figcaption>
                    Vista remota de la fuente · sugerida, sin importar. Variante: {selected?.title}.
                    Derechos: NO VERIFICADO.
                  </figcaption>
                  <a href={p.imageUrl} target="_blank" rel="noreferrer">
                    Imagen original
                  </a>
                </figure>
              ))}
            </div>
            {currentPhotos.length === 0 && (
              <p>Sin fotografía específica en la fuente. No se reutiliza la de otra variante.</p>
            )}
            <button
              className="pm2-open-review"
              aria-expanded={reviewOpen}
              onClick={() => setReviewOpen(!reviewOpen)}
            >
              Revisar fotografía seleccionada
            </button>
            <div className="pm2-review-drawer" hidden={!reviewOpen}>
              <label>
                Persona revisora de imágenes
                <input
                  value={reviewer}
                  onChange={(e) => {
                    setReviewer(e.target.value);
                    onDirty(true);
                  }}
                />
              </label>
              <label>
                Evidencia de autorización comercial
                <textarea
                  value={rightsEvidence}
                  onChange={(e) => {
                    setRightsEvidence(e.target.value);
                    onDirty(true);
                  }}
                />
              </label>
              <label className="pm2-check">
                <input
                  type="checkbox"
                  checked={exact}
                  onChange={(e) => setExact(e.target.checked)}
                />
                Revisé la coincidencia exacta de esta variante
              </label>
              <p>Una declaración local no verifica derechos ni habilita incorporación.</p>
              <div className="pm2-actions">
                <button onClick={() => decide('APPROVE')}>Revisar aprobación de candidata</button>
                <button onClick={() => decide('REJECT')}>Rechazar candidata</button>
                <button onClick={() => decide('SUBSTITUTE')}>Sustituir candidata</button>
                <button disabled>Incorporar · autorización del servidor pendiente</button>
              </div>
              <p role="status">{message}</p>
              {decisions
                .filter((d) => d.variantId === variantId)
                .map((d, i) => (
                  <p key={i}>
                    {d.at} · {d.action} · {d.reviewer}
                  </p>
                ))}
              <button onClick={exportDecisions}>Exportar decisiones de imágenes</button>
            </div>
            <details className="pm2-variant-evidence">
              <summary>Procedencia y datos de la variante</summary>
              <p>
                Fuente oficial consultada {official.checkedAt}. ID externo: {variantId}. No es un ID
                comercial LIHEN. Precio compartido: NO VERIFICADO. Precio individual e inventario
                por variante: SIN DATOS. Las presentaciones de 30 y 50 ml son distintas y ninguna
                está asignada a {sku}.
              </p>
            </details>
          </article>
        </>
      ) : (
        <p>
          No hay variantes oficiales documentadas para este candidato Style. Sus imágenes de
          proveedor permanecen en la galería general; no se asignan a un color o talla sin
          evidencia.
        </p>
      )}
      <article className="pm2-variant-detail pm2-demand" hidden={media}>
        <h4>
          Demanda por variante · {selected && beauty ? selected.title : 'sin variante confirmada'}
        </h4>
        <div className="pm2-stats">
          {[
            ['Unidades vendidas', demand.status],
            ['Ingresos por variante', demand.status],
            ['Rotación', demand.status],
            ['Pedidos registrados', demand.status],
          ].map(([title, value]) => (
            <div key={title}>
              <small>{title}</small>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="pm2-empty-chart">
          <svg width="230" height="70" viewBox="0 0 230 70" fill="none" aria-hidden="true">
            <path d="M15 5v50h200" stroke="#d9dce7" />
            <path d="M15 20h200M15 38h200" stroke="#e8eaf0" strokeDasharray="4 5" />
          </svg>
          <strong>Sin datos atribuibles a esta variante</strong>
          <span>No se reparte el inventario ni las ventas del producto entre tonos.</span>
        </div>
        <details>
          <summary>Por qué no hay estadísticas</summary>
          <p>
            Pedidos, ventas, POS e inventario se relacionan por producto y no atribuyen datos
            verificables a estas variantes. Demanda histórica y reposición: SIN DATOS. No se
            infieren de fotografías o Internet.
          </p>
        </details>
      </article>
    </section>
  );
}
