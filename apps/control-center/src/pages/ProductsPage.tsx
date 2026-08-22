import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProductListItemDTO } from '@lihen/products';
import { createGetProductsQuery } from '@lihen/products';
import { PageHeader } from '../components/PageHeader';
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

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <section>
      <div className="page-heading-row">
        <PageHeader
          title="Productos"
          description="Product Master canónico conectado a Supabase DEV. La lectura de taxonomía se resuelve en bloque para evitar consultas repetitivas."
        />
        <Link
          className={`button-link${productsComposition.canCreate ? '' : ' button-link--disabled'}`}
          to={productsComposition.canCreate ? '/products/new' : '/products'}
          aria-disabled={!productsComposition.canCreate}
        >
          <span aria-hidden="true">＋</span>
          Nuevo producto
        </Link>
      </div>

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
                  <th scope="col">Código catálogo</th>
                  <th scope="col">Marca</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="align-right">Precio</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => (
                  <tr key={product.id}>
                    <td><span className="code-text">{product.sku ?? '—'}</span></td>
                    <td><strong><Link to={`/products/${product.id}`}>{product.name}</Link></strong></td>
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
