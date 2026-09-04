import { useEffect, useMemo, useState } from 'react';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import {
  cloudWorkspaceComposition,
  type CloudWorkspaceAsset,
  type CloudWorkspaceRegistryKind,
} from '../composition/cloud-workspace';

const ALL = 'ALL';

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTimestamp(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function kindLabel(kind: CloudWorkspaceRegistryKind): string {
  const labels: Record<CloudWorkspaceRegistryKind, string> = {
    PRODUCT_IMAGE: 'Imagen de producto',
    CATALOG_ASSET: 'Asset de catálogo',
    CATALOG_PDF: 'PDF de catálogo',
    STORAGE_OBJECT: 'Objeto de storage',
  };
  return labels[kind];
}

export function CloudWorkspacePage() {
  const [assets, setAssets] = useState<readonly CloudWorkspaceAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState(ALL);
  const [bucketFilter, setBucketFilter] = useState(ALL);

  useEffect(() => {
    let active = true;

    cloudWorkspaceComposition
      .listAssets()
      .then((nextAssets) => {
        if (active) setAssets(nextAssets);
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No fue posible cargar el registry de LIHEN Cloud.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const buckets = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.bucketId))).sort(),
    [assets],
  );

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-CO');

    return assets.filter((asset) => {
      if (kindFilter !== ALL && asset.registryKind !== kindFilter) return false;
      if (bucketFilter !== ALL && asset.bucketId !== bucketFilter) return false;
      if (!query) return true;

      return [
        asset.objectPath,
        asset.bucketId,
        asset.variant,
        asset.productIdRef,
        asset.productImageIdRef,
        asset.catalogVersionIdRef,
        asset.assetNamespace,
        asset.assetKey,
        asset.mimeType,
      ].some((value) => value?.toLocaleLowerCase('es-CO').includes(query));
    });
  }, [assets, bucketFilter, kindFilter, search]);

  const stats = useMemo(() => {
    const knownBytes = assets.reduce((sum, asset) => sum + (asset.byteSize ?? 0), 0);
    return {
      productImages: assets.filter((asset) => asset.registryKind === 'PRODUCT_IMAGE').length,
      catalogAssets: assets.filter((asset) => asset.registryKind === 'CATALOG_ASSET').length,
      catalogPdfs: assets.filter((asset) => asset.registryKind === 'CATALOG_PDF').length,
      knownBytes,
    };
  }, [assets]);

  const intelligenceInsights = useMemo<readonly IntelligenceInsight[]>(
    () => [
      {
        id: 'cloud-authority',
        severity: 'SUCCESS',
        title: 'Registry unificado sin duplicar Storage',
        explanation:
          'La pantalla consulta la proyección pública de GAP-031. La autoridad física continúa en storage.objects y en los registros especializados existentes.',
        source: 'public.unified_asset_artifact_registry',
      },
      {
        id: 'cloud-read-only',
        severity: 'INFO',
        title: 'Workspace en modo de lectura',
        explanation:
          'GAP-032 permite descubrir, buscar y auditar activos. Upload, delete, cambios de metadata, publishing y mutaciones canónicas permanecen fuera de alcance.',
        source: 'WAVE 9 / GAP-032',
      },
      {
        id: 'cloud-rls',
        severity: 'INFO',
        title: 'Acceso preservado por RLS',
        explanation:
          'La vista mantiene security_invoker y la lectura de Storage se limita a perfiles ACTIVE con rol OWNER o ADMIN sobre los buckets LIHEN Cloud autorizados.',
        source: 'storage.objects RLS',
      },
    ],
    [],
  );

  return (
    <section className="stack">
      <AdminPageHero
        eyebrow="LIHEN CLOUD"
        title="Workspace de activos y artefactos"
        description="Descubre imágenes, assets editoriales y artefactos PDF desde una vista unificada, sin crear una segunda autoridad de almacenamiento."
        accent="pink"
        status={<span className="status-badge">READ ONLY · DEV</span>}
      />

      {!loading && !error ? (
        <SummaryStrip
          items={[
            { label: 'Objetos visibles', value: assets.length },
            { label: 'Imágenes producto', value: stats.productImages },
            { label: 'Assets catálogo', value: stats.catalogAssets },
            { label: 'PDF catálogo', value: stats.catalogPdfs },
            { label: 'Tamaño conocido', value: formatBytes(stats.knownBytes) },
          ]}
        />
      ) : null}

      <OperationalNotice title="LIHEN Cloud no reemplaza Storage" tone="info" meta="Registry + RLS">
        <p>
          Este workspace es una superficie de descubrimiento. No decide el asset canónico, no mueve
          objetos y no habilita escrituras sobre buckets.
        </p>
      </OperationalNotice>

      {!loading && !error ? (
        <IntelligencePanel title="Gobernanza del workspace" insights={intelligenceInsights} />
      ) : null}

      {loading ? (
        <div className="loading-card" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <div>
            <strong>Cargando LIHEN Cloud</strong>
            <p>Consultando el registry unificado de activos y artefactos en Supabase DEV…</p>
          </div>
        </div>
      ) : null}

      {error ? <div className="error-state" role="alert">{error}</div> : null}

      {!loading && !error ? (
        <div className="table-card">
          <div className="table-summary">
            <div>
              <strong>{filteredAssets.length} resultados</strong>
              <br />
              <span>Fuente: {cloudWorkspaceComposition.source}</span>
            </div>

            <div className="toolbar" aria-label="Filtros de LIHEN Cloud">
              <label>
                <span className="sr-only">Buscar activos</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar ruta, producto, asset…"
                />
              </label>

              <label>
                <span className="sr-only">Filtrar por tipo</span>
                <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}>
                  <option value={ALL}>Todos los tipos</option>
                  <option value="PRODUCT_IMAGE">Imágenes de producto</option>
                  <option value="CATALOG_ASSET">Assets de catálogo</option>
                  <option value="CATALOG_PDF">PDF de catálogo</option>
                  <option value="STORAGE_OBJECT">Otros objetos</option>
                </select>
              </label>

              <label>
                <span className="sr-only">Filtrar por bucket</span>
                <select value={bucketFilter} onChange={(event) => setBucketFilter(event.target.value)}>
                  <option value={ALL}>Todos los buckets</option>
                  {buckets.map((bucket) => (
                    <option key={bucket} value={bucket}>{bucket}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {filteredAssets.length === 0 ? (
            <div className="empty-state">
              <strong>No hay resultados para los filtros actuales.</strong>
              <p>El registry no fue modificado; ajusta la búsqueda o los filtros.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Tipo</th>
                    <th scope="col">Bucket</th>
                    <th scope="col">Ruta</th>
                    <th scope="col">Variante</th>
                    <th scope="col">Referencia</th>
                    <th scope="col">MIME</th>
                    <th scope="col" className="align-right">Tamaño</th>
                    <th scope="col">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => {
                    const reference =
                      asset.productIdRef
                      ?? asset.catalogVersionIdRef
                      ?? asset.assetKey
                      ?? asset.productImageIdRef
                      ?? '—';

                    return (
                      <tr key={`${asset.bucketId}:${asset.objectPath}`}>
                        <td>{kindLabel(asset.registryKind)}</td>
                        <td><span className="code-text">{asset.bucketId}</span></td>
                        <td><span className="code-text">{asset.objectPath}</span></td>
                        <td>{asset.variant ?? '—'}</td>
                        <td><span className="code-text">{reference}</span></td>
                        <td>{asset.mimeType ?? '—'}</td>
                        <td className="align-right">
                          {asset.byteSize === null ? '—' : formatBytes(asset.byteSize)}
                        </td>
                        <td>{formatTimestamp(asset.updatedAt ?? asset.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
