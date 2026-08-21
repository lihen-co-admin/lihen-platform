import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createChangeProductSalePriceCommand,
  createGetProductByIdQuery,
  ProductNotFoundError,
  ProductSalePriceUnchangedError,
  ProductWriteBlockedError,
  type ProductDetailDTO,
} from '@lihen/products';
import { PageHeader } from '../components/PageHeader';
import { productsComposition } from '../composition/products';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ChangeProductSalePricePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canChangePrice = productsComposition.canChangePrice;

  useEffect(() => {
    let active = true;

    if (!id) {
      setNotFound(true);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    productsComposition.getProductById
      .execute(createGetProductByIdQuery(id))
      .then((result) => {
        if (!active) return;
        if (!result) {
          setNotFound(true);
          return;
        }
        setProduct(result);
        setNewPrice(String(result.salePrice.amount));
      })
      .catch(() => {
        if (active) setError('No fue posible cargar el producto.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!id || !canChangePrice) {
      setError('La escritura a Supabase DEV permanece bloqueada hasta aprobar FASE 1.2.1.');
      return;
    }

    const numericPrice = Number(newPrice);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setError('Ingresa un precio válido mayor o igual a 0.');
      return;
    }

    setSubmitting(true);

    try {
      await productsComposition.changeProductSalePrice.execute(
        createChangeProductSalePriceCommand({
          commandId: crypto.randomUUID(),
          operationKey: crypto.randomUUID(),
          actorId: 'development-user',
          requestedAt: new Date(),
          productId: id,
          newPrice: numericPrice,
          reason,
        }),
      );
      navigate(`/products/${id}`);
    } catch (caught) {
      if (caught instanceof ProductNotFoundError) {
        setNotFound(true);
      } else if (caught instanceof ProductSalePriceUnchangedError) {
        setError('El nuevo precio debe ser diferente al precio actual.');
      } else if (caught instanceof ProductWriteBlockedError) {
        setError('La escritura a Supabase DEV permanece bloqueada hasta aprobar FASE 1.2.1.');
      } else {
        setError('No fue posible cambiar el precio. Revisa el valor y el motivo.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <PageHeader
        title="Cambiar precio de venta"
        description="FASE 1.6: el precio se modifica únicamente mediante ChangeProductSalePrice y conserva historial append-only en memoria."
      />

      <p><Link to={id ? `/products/${id}` : '/products'}>← Volver al producto</Link></p>

      {!canChangePrice ? (
        <div className="warning-state" role="status">
          <strong>Cambio de precio bloqueado.</strong>
          <p>Supabase continúa en solo lectura hasta aprobar el precheck de esquema + RLS de FASE 1.2.1.</p>
        </div>
      ) : null}

      {loading ? <div className="empty-state">Cargando producto…</div> : null}
      {notFound && !loading ? <div className="empty-state"><strong>Producto no encontrado.</strong></div> : null}

      {!loading && !notFound && product ? (
        <form className="product-form" onSubmit={handleSubmit}>
          <div className="info-state">
            <strong>{product.name}</strong>
            <p>Precio actual: {formatMoney(product.salePrice.amount)}</p>
          </div>

          <div className="form-grid">
            <label>
              <span>Nuevo precio de venta (COP) *</span>
              <input
                type="number"
                min="0"
                step="1"
                value={newPrice}
                onChange={(event) => setNewPrice(event.target.value)}
                required
                disabled={!canChangePrice || submitting}
              />
            </label>

            <label className="form-field--wide">
              <span>Motivo del cambio *</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={3}
                required
                placeholder="Ej. Ajuste comercial aprobado"
                disabled={!canChangePrice || submitting}
              />
            </label>
          </div>

          {error ? <div className="error-state" role="alert">{error}</div> : null}

          <div className="form-actions">
            <Link className="button-link button-link--secondary" to={id ? `/products/${id}` : '/products'}>Cancelar</Link>
            <button type="submit" disabled={!canChangePrice || submitting}>
              {submitting ? 'Guardando…' : 'Cambiar precio'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
