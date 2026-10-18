import { useEffect, useRef, useState } from 'react';
import {
  buildVerifiedImageQuery,
  reviewProductPhotograph,
  type ProductImageResearchReport,
} from '@lihen/intelligence-core';
import {
  evaluateProductMediaSourceReadiness,
  selectProductMediaSource,
  type ProductDetailDTO,
  type ProductImageDTO,
} from '@lihen/products';
import {
  evaluateExistingProductImage,
  productImageSearchIdentity,
  verifiedImageResearch,
} from '../composition/visual-intelligence';
import { manualImageCapacity } from '../lib/product-image-webp';
import { EXTERNAL_PRODUCT_IMAGE_SAVE_NOTICE } from '../composition/external-product-image-save';
import { VerifiedProductImagePreview } from './VerifiedProductImagePreview';

export function VerifiedProductImagesPanel({
  product,
  images,
  dimensions = {},
  galleryReadable,
  stagedCount,
  authorized,
  userId,
}: {
  readonly product: ProductDetailDTO;
  readonly images: readonly ProductImageDTO[];
  readonly dimensions?: Readonly<Record<string, { widthPx: number; heightPx: number }>>;
  readonly galleryReadable: boolean;
  readonly stagedCount: number;
  readonly authorized: boolean;
  readonly userId?: string | undefined;
}) {
  const [report, setReport] = useState<ProductImageResearchReport | null>(null);
  const [reportScope,setReportScope]=useState('');
  const [approved, setApproved] = useState<readonly string[]>([]);
  const [rejected,setRejected]=useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    setReport(null);setApproved([]);setRejected([]);setMessage('');setBusy(false);
    return () => {generation.current += 1;};
  }, [product.id, product.name, product.sku, product.brandId, userId, authorized]);
  const identity = productImageSearchIdentity(product);
  const query = buildVerifiedImageQuery(identity);
  const scope=JSON.stringify([product.id,product.name,product.sku,product.brandId,userId,authorized]);
  const candidates = (reportScope===scope ? report?.candidates ?? [] : []).filter(image=>!rejected.includes(image.imageUrl)).slice(0,5);
  const sources = candidates
    .filter(
      (item) =>
        reviewProductPhotograph(item, false, false, new Date().toISOString()) === 'RIGHTS_VERIFIED',
    )
    .map((item) => ({
      sourceId: item.imageUrl,
      sourceType: 'OFFICIAL_WEB' as const,
      isExactProductMatch: true,
      publicationEligibility: 'ELIGIBLE_PRIMARY' as const,
      ...(item.widthPx !== undefined ? { widthPx: item.widthPx } : {}),
      ...(item.heightPx !== undefined ? { heightPx: item.heightPx } : {}),
    }));
  const suggested = selectProductMediaSource('CATALOG_PDF', sources).source?.sourceId;
  const capacity = galleryReadable
    ? manualImageCapacity(images.length, stagedCount)
    : null;

  async function search() {
    if (!authorized || !userId || !query || !verifiedImageResearch.configured || busy) return;
    const current = ++generation.current;
    setBusy(true);
    setMessage('');
    setApproved([]);
    setRejected([]);
    setReport(null);
    try {
      const next = await verifiedImageResearch.research(
        identity,
        {
          correlationId: crypto.randomUUID(),
          requestedBy: userId,
          context: { contextId: product.id, type: 'PRODUCT', entityId: product.id, attributes: {} },
        },
        verifiedImageResearch.dependencies,
      );
      if (current === generation.current) {setReportScope(scope);setReport(next);}
    } catch {
      setMessage('No fue posible verificar el proveedor. No se aprobaron imágenes.');
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <section className="detail-card" aria-labelledby="verified-images-title">
      <h2 id="verified-images-title">LIHEN Intelligence — Imágenes verificadas</h2>
      <p role="status">{EXTERNAL_PRODUCT_IMAGE_SAVE_NOTICE}</p>
      <button type="button" disabled>
        Guardado externo deshabilitado
      </button>
      <p>
        Identidad y referencia: {product.name} · {product.brandName ?? 'Marca sin asignar'}.
      </p>
      <p>
        Fabricante, referencia oficial y variante: no expuestos por Product Master. El SKU y el
        código de catálogo internos no certifican una referencia externa.
      </p>
      <h3>Evaluación de la imagen actual</h3>
      {!galleryReadable ? (
        <p>Lectura bloqueada: evaluación y cupos no verificables.</p>
      ) : images.length === 0 ? (
        <p>No hay imágenes registradas.</p>
      ) : (
        images.map((image) => {
          const evaluation = evaluateExistingProductImage(image, dimensions[image.id]);
          return (
            <p key={image.id}>
              {image.isMain ? 'Principal' : 'Complementaria'} · {image.sourceType}
              {' · Identidad: '}
              {evaluation.identityMatch}
              {' · Calidad: '}
              {evaluation.quality}. Se conserva como evidencia; no se sustituye.
            </p>
          );
        })
      )}
      <p>Alta resolución no acredita identidad ni derechos de uso.</p>
      {!query ? (
        <p role="status">
          INSUFFICIENT_EVIDENCE: falta evidencia de la referencia exacta; búsqueda bloqueada.
        </p>
      ) : null}
      {!verifiedImageResearch.configured ? (
        <p role="status">
          SEARCH_PROVIDER_NOT_CONFIGURED: el proveedor existente no entrega evidencia verificable de
          fotografías y derechos.
        </p>
      ) : null}
      <button
        type="button"
        disabled={!authorized || !userId || !query || !verifiedImageResearch.configured || busy}
        onClick={() => void search()}
      >
        Buscar imágenes con LIHEN Intelligence
      </button>
      <button type="button" disabled={!authorized || busy || capacity===null || capacity<=0} onClick={()=>document.getElementById('manual-product-images')?.click()}>Subir imagen propia</button>
      {report ? <p role="status">Estado de búsqueda: {report.status}</p> : null}
      {candidates.length === 0 ? (
        <p>
          No se encontraron imágenes verificadas de esta referencia. Completa la galería con
          fotografías propias.
        </p>
      ) : (
        candidates.map((image) => {
          const stage = reviewProductPhotograph(
            image,
            authorized,
            false,
            new Date().toISOString(),
          );
          const quality = evaluateProductMediaSourceReadiness({
            sourceType: 'OFFICIAL_WEB',
            isExactProductMatch: image.identityMatch === 'EXACT_MATCH',
            publicationEligibility: 'ELIGIBLE_PRIMARY',
            ...(image.widthPx !== undefined ? { widthPx: image.widthPx } : {}),
            ...(image.heightPx !== undefined ? { heightPx: image.heightPx } : {}),
          });
          return (
            <article key={image.imageUrl} className="image-card">
              <VerifiedProductImagePreview key={image.imageUrl} image={image}/>
              <h3>
                {image.imageUrl === suggested
                  ? 'Principal sugerida'
                  : image.rightsStatus === 'RIGHTS_VERIFIED'
                    ? 'Galería complementaria sugerida'
                    : 'Candidato de identidad: derechos pendientes'}
              </h3>
              <p>
                {image.identityMatch} · {quality} · {image.rightsStatus} · {stage}
              </p>
              <p>
                Referencia: {image.identity.knownAttributes?.officialReference} · Variante:
                {JSON.stringify(image.identity.knownAttributes)}
              </p>
              <p>
                Dimensiones: {image.widthPx ?? '?'} × {image.heightPx ?? '?'}
              </p>
              <p>
                Fuente:{' '}
                <a href={image.sourceUrl} target="_blank" rel="noreferrer">
                  {image.sourceUrl}
                </a>
              </p>
              <p>
                Recurso:{' '}
                <a href={image.imageUrl} target="_blank" rel="noreferrer">
                  {image.imageUrl}
                </a>
              </p>
              <p>
                Autoridad: {image.authority} · {image.authorityEvidenceRef} · Comprobación:{' '}
                {image.checkedAt}
              </p>
              <p>Motivos: {image.reasons.join(' · ')}</p>
              <button type="button" disabled={!authorized||busy} onClick={()=>{setRejected(previous=>[...previous,image.imageUrl]);setApproved(previous=>previous.filter(url=>url!==image.imageUrl));}}>Rechazar candidato</button>
              <button type="button" disabled={!authorized||busy||!verifiedImageResearch.configured} onClick={()=>void search()}>Buscar reemplazo sin sustituir fotografías guardadas</button>
              <button type="button" disabled>Aprobar y registrar · requiere autorización servidor</button>
              <details>
                <summary>Evidencias de coincidencia y derechos</summary>
                {image.evidence.map((e) => (
                  <p key={e.id}>
                    {e.id}: {e.text}
                  </p>
                ))}
              </details>
              <label>
                <input
                  type="checkbox"
                  disabled={!authorized || image.rightsStatus !== 'RIGHTS_VERIFIED' || busy}
                  checked={approved.includes(image.imageUrl)}
                  onChange={(event) =>
                    setApproved((previous) =>
                      event.target.checked
                        ? [...previous, image.imageUrl]
                        : previous.filter((url) => url !== image.imageUrl),
                    )
                  }
                />
                Selección para revisión local. No autoriza descarga ni guardado.
              </label>
            </article>
          );
        })
      )}
      {report?.rejected.map((image) => (
        <p key={image.imageUrl}>
          Rechazada: {image.imageUrl} ·{image.identityMatch} · {image.reasons.join(' · ')}
        </p>
      ))}
      <p>Cupos restantes para subida manual: {capacity ?? 'No verificable'}.</p>
      <p>
        La selección no descarga ni guarda imágenes y no se transfiere a la cola manual. Sustituir
        imágenes, cambiar la principal o publicar requieren confirmación independiente.
      </p>
      {message ? <p role="alert">{message}</p> : null}
    </section>
  );
}
