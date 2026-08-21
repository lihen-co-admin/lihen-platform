import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createGetProductByIdQuery,
  createGetProductSalePriceHistoryQuery,
  type ProductDetailDTO,
  type ProductSalePriceChangeDTO,
} from '@lihen/products';
import { PageHeader } from '../components/PageHeader';
import { productsComposition } from '../composition/products';

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: ProductDetailDTO['status']): string {
  const labels: Record<ProductDetailDTO['status'], string> = {
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    DISCONTINUED: 'Descontinuado',
    ARCHIVED: 'Archivado',
  };

  return labels[status];
}

export function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [priceHistory, setPriceHistory] = useState<readonly ProductSalePriceChangeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!id) {
      setLoading(false);
      setNotFound(true);
      return () => {
        active = false;
      };
    }

    Promise.all([
      productsComposition.getProductById.execute(createGetProductByIdQuery(id)),
      productsComposition.canReadPriceHistory
        ? productsComposition.getProductSalePriceHistory.execute(
            createGetProductSalePriceHistoryQuery(id),
          )
        : Promise.resolve([]),
    ])
      .then(([result, history]) => {
        if (!active) return;
        if (!result) {
          setNotFound(true);
          return;
        }
        setProduct(result);
        setPriceHistory(history);
      })
      .catch(() => {
        if (active) setError('No fue posible cargar el detalle del producto.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <section>
      <PageHeader
        title="Detalle de producto"
        description="Consulta individual mediante GetProductById; desde FASE 1.6 el precio tiene un comando e historial separados."
      />

      <div className="detail-actions">
        <Link to="/products">← Volver a productos</Link>
        {id && productsComposition.canUpdate ? (
          <Link className="button-link" to={`/products/${id}/edit`}>Editar producto</Link>
        ) : null}
        {id && productsComposition.canChangePrice ? (
          <Link className="button-link" to={`/products/${id}/price`}>Cambiar precio</Link>
        ) : null}
        {id ? (
          <Link className="button-link" to={`/products/${id}/images`}>Imágenes</Link>
        ) : null}
      </div>

      {loading ? <div className="empty-state">Cargando producto…</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}

      {!loading && !error && notFound ? (
        <div className="empty-state">
          <strong>Producto no encontrado.</strong>
          <p>No existe un producto visible para el identificador solicitado.</p>
        </div>
      ) : null}

      {!loading && !error && product ? (
        <>
          <div className="detail-card">
            <dl className="detail-grid">
              <div><dt>Nombre</dt><dd>{product.name}</dd></div>
              <div><dt>SKU</dt><dd>{product.sku ?? '—'}</dd></div>
              <div><dt>Código catálogo</dt><dd>{product.catalogCode ?? '—'}</dd></div>
              <div><dt>Marca canónica</dt><dd>{product.brandName ?? 'Pendiente normalización'}</dd></div>
              <div><dt>Categoría canónica</dt><dd>{product.categoryName ?? 'Pendiente normalización'}</dd></div>
              <div><dt>Estado</dt><dd>{statusLabel(product.status)}</dd></div>
              <div><dt>Precio</dt><dd>{formatMoney(product.salePrice.amount, product.salePrice.currency)}</dd></div>
              <div><dt>Fuente</dt><dd>{productsComposition.source === 'supabase' ? 'Supabase DEV' : 'repositorio en memoria'}</dd></div>
            </dl>
          </div>

          <section className="detail-card" aria-labelledby="price-history-title">
            <h2 id="price-history-title">Historial de precio</h2>
            {!productsComposition.canReadPriceHistory ? (
              <p className="muted-text">El historial persistente está preparado en Supabase, pero su lectura desde la UI permanece bloqueada hasta cerrar el gate de Auth/JWT/perfil.</p>
            ) : priceHistory.length === 0 ? (
              <p className="muted-text">Aún no existen cambios de precio registrados en esta sesión/fuente.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Anterior</th>
                      <th>Nuevo</th>
                      <th>Motivo</th>
                      <th>Actor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.changedAt)}</td>
                        <td>{formatMoney(entry.previousPrice.amount, entry.previousPrice.currency)}</td>
                        <td>{formatMoney(entry.newPrice.amount, entry.newPrice.currency)}</td>
                        <td>{entry.reason}</td>
                        <td>{entry.actorId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
