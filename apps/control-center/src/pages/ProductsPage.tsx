import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProductListItemDTO } from '@lihen/products';
import { createGetProductsQuery } from '@lihen/products';
import { PageHeader } from '../components/PageHeader';
import { productsComposition } from '../composition/products';

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

  return (
    <section>
      <div className="page-heading-row">
        <PageHeader
          title="Productos"
          description="Lectura desacoplada de productos: la página consume GetProducts y el composition root decide entre memoria o Supabase DEV."
        />
        <Link className={`button-link${productsComposition.canCreate ? "" : " button-link--disabled"}`} to={productsComposition.canCreate ? "/products/new" : "/products"} aria-disabled={!productsComposition.canCreate}>
          Nuevo producto
        </Link>
      </div>

      {loading ? <div className="empty-state">Cargando productos…</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}

      {!loading && !error && products.length === 0 ? (
        <div className="empty-state">
          <strong>No hay productos.</strong>
          <p>El repositorio en memoria no devolvió registros.</p>
        </div>
      ) : null}

      {!loading && !error && products.length > 0 ? (
        <div className="table-card">
          <div className="table-summary">
            <strong>{products.length} productos</strong>
            <span>Fuente: {productsComposition.source === 'supabase' ? 'Supabase DEV' : 'repositorio en memoria'}</span>
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
                {products.map((product) => (
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
        </div>
      ) : null}
    </section>
  );
}
