import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProductListItemDTO } from '@lihen/products';
import { createGetProductsQuery } from '@lihen/products';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { productsComposition } from '../composition/products';

const PAGE_SIZE = 25;

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusLabel(status: ProductListItemDTO['status']): string {
  const labels: Record<ProductListItemDTO['status'], string> = {
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    DISCONTINUED: 'Descontinuado',
    ARCHIVED: 'Archivado',
  };

  return labels[status];
}

export function ProductsPage() {
  const [products, setProducts] = useState<readonly ProductListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    productsComposition.getProducts
      .execute(createGetProductsQuery())
      .then((result) => {
        if (active) setProducts(result);
      })
      .catch(() => {
        if (active) setError('No fue posible cargar los productos desde la fuente configurada.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-CO');
    if (!query) return products;

    return products.filter((product) => [
      product.name,
      product.sku,
      product.catalogCode,
      product.brandName,
      product.categoryName,
    ].some((value) => value?.toLocaleLowerCase('es-CO').includes(query)));
  }, [products, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleProducts = filteredProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const productStats = useMemo(() => ({
    active: products.filter((product) => product.status === 'ACTIVE').length,
    inactive: products.filter((product) => product.status === 'INACTIVE').length,
    archived: products.filter((product) => product.status === 'ARCHIVED' || product.status === 'DISCONTINUED').length,
    taxonomyPending: products.filter((product) => !product.brandName || !product.categoryName).length,
    beautyCare: products.filter((product) => product.businessLine === 'BEAUTY_CARE').length,
    style: products.filter((product) => product.businessLine === 'STYLE').length,
  }), [products]);

  const intelligenceInsights = useMemo<readonly IntelligenceInsight[]>(() => {
    const insights: IntelligenceInsight[] = [];

    if (productStats.taxonomyPending > 0) {
      insights.push({
        id: 'taxonomy',
        severity: 'WARNING',
        title: `${productStats.taxonomyPending} productos requieren normalización`,
        explanation: 'Falta marca o categoría canónica. Conviene resolver taxonomía antes de evaluar publicación y generación de catálogos.',
        source: 'Product Master',
      });
    }

    if (productStats.inactive + productStats.archived > 0) {
      insights.push({
        id: 'lifecycle',
        severity: 'INFO',
        title: `${productStats.inactive + productStats.archived} productos fuera de oferta activa`,
        explanation: 'INACTIVE, DISCONTINUED y ARCHIVED conservan identidad e historia. No deben tratarse como candidatos publicables solo por existir en Product Master.',
        source: 'Product lifecycle',
      });
    }

    insights.push({
      id: 'write-mode',
      severity: productsComposition.canUpdate ? 'SUCCESS' : 'INFO',
      title: productsComposition.canUpdate ? 'Edición controlada disponible' : 'Edición protegida por configuración',
      explanation: productsComposition.canUpdate
        ? 'Los cambios usan el flujo controlado de Product Master y mantienen pricing, media e inventario como responsabilidades separadas.'
        : 'La lectura funciona, pero el modo de actualización no está habilitado en esta sesión. No es ausencia de CRUD.',
      source: 'composition/products',
    });

    insights.push({
      id: 'archive-policy',
      severity: 'INFO',
      title: 'Conservar historia antes que borrar',
      explanation: 'LIHEN prioriza inactivar, descontinuar o archivar productos frente a un DELETE físico que rompa trazabilidad.',
      source: 'Regla de dominio',
    });

    return insights;
  }, [productStats.archived, productStats.inactive, productStats.taxonomyPending]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <section className="stack products-page">
      <AdminPageHero
        eyebrow="PRODUCT MASTER"
        title="Productos"
        description="Administra identidad, taxonomía y lifecycle desde una sola base canónica. Pricing, media, inventario y publicación permanecen separados y trazables."
        accent="pink"
        actions={(
          <Link
            className={`button-link${productsComposition.canCreate ? '' : ' button-link--disabled'}`}
            to={productsComposition.canCreate ? '/products/new' : '/products'}
            aria-disabled={!productsComposition.canCreate}
          >
            <span aria-hidden="true">＋</span>
            Nuevo producto
          </Link>
        )}
        status={<span className="status-badge">PRODUCT MASTER</span>}
      />

      {!loading && !error ? (
        <SummaryStrip
          items={[
            { label: 'Total', value: products.length },
            { label: 'Activos', value: productStats.active },
            { label: 'Beauty Care', value: productStats.beautyCare },
            { label: 'Style', value: productStats.style },
            { label: 'Taxonomía pendiente', value: productStats.taxonomyPending },
            { label: 'Fuera de oferta', value: productStats.inactive + productStats.archived },
          ]}
        />
      ) : null}

      <OperationalNotice title="Product Master no equivale a publicación" tone="info" meta="Identity + lifecycle">
        <p>Un producto puede estar correctamente registrado y aun así no estar listo para catálogo o storefront. Precio, media, elegibilidad, snapshot y gates de publicación se evalúan por separado.</p>
      </OperationalNotice>

      {!loading && !error && products.length > 0 ? (
        <IntelligencePanel title="Inteligencia de Product Master" insights={intelligenceInsights} />
      ) : null}

      {loading ? (
        <div className="loading-card" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <div>
            <strong>Cargando Product Master</strong>
            <p>Consultando productos y taxonomía canónica en Supabase DEV…</p>
          </div>
        </div>
      ) : null}

      {error ? <div className="error-state" role="alert">{error}</div> : null}

      {!loading && !error && products.length === 0 ? (
        <div className="empty-state">
          <strong>No hay productos.</strong>
          <p>La fuente configurada no devolvió registros.</p>
        </div>
      ) : null}

      {!loading && !error && products.length > 0 ? (
        <div className="table-card">
          <div className="table-toolbar">
            <div className="table-summary-copy">
              <strong>{products.length} productos</strong>
              <span>Fuente: {productsComposition.source === 'supabase' ? 'Supabase DEV' : 'repositorio en memoria'}</span>
            </div>
            <label className="table-search">
              <span className="sr-only">Buscar productos</span>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => handleSearch(event.target.value)}
                placeholder="Buscar por producto, SKU, marca…"
              />
            </label>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">Producto</th>
                  <th scope="col">Línea</th>
                  <th scope="col">Código catálogo</th>
                  <th scope="col">Marca</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="align-right">Precio</th>
                  <th scope="col" className="align-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => (
                  <tr key={product.id}>
                    <td><span className="code-text">{product.sku ?? '—'}</span></td>
                    <td><strong><Link to={`/products/${product.id}`}>{product.name}</Link></strong></td>
                    <td>{product.businessLine === 'BEAUTY_CARE' ? 'Beauty Care' : 'Style'}</td>
                    <td>{product.catalogCode ?? '—'}</td>
                    <td>{product.brandName ?? 'Pendiente normalización'}</td>
                    <td>{product.categoryName ?? 'Pendiente normalización'}</td>
                    <td>
                      <span className={`product-status product-status--${product.status.toLowerCase()}`}>
                        {statusLabel(product.status)}
                      </span>
                    </td>
                    <td className="align-right">
                      {formatMoney(product.salePrice.amount, product.salePrice.currency)}
                    </td>
                    <td className="align-right">
                      <div className="row-actions">
                        <Link className="table-action" to={`/products/${product.id}`}>Ver</Link>
                        {productsComposition.canUpdate ? <Link className="table-action" to={`/products/${product.id}/edit`}>Editar</Link> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-pagination">
            <span>
              {filteredProducts.length === 0
                ? '0 resultados'
                : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredProducts.length)} de ${filteredProducts.length}`}
            </span>
            <div className="pagination-actions" aria-label="Paginación de productos">
              <button type="button" className="icon-button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                ‹ <span className="sr-only">Página anterior</span>
              </button>
              <span>Página {safePage} de {totalPages}</span>
              <button type="button" className="icon-button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                › <span className="sr-only">Página siguiente</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
