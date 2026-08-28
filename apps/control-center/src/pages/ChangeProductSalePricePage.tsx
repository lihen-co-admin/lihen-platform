import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createChangeProductSalePriceCommand,
  createGetProductByIdQuery,
  ProductNotFoundError,
  ProductSalePriceUnchangedError,
  ProductWriteBlockedError,
  type ProductDetailDTO,
} from '@lihen/products';
import { useAuth } from '../auth/auth-context';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { productsComposition } from '../composition/products';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}

export function ChangeProductSalePricePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canChangePrice = productsComposition.canChangePrice && auth.authorized;

  useEffect(() => {
    let active = true;
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return () => { active = false; };
    }
    productsComposition.getProductById.execute(createGetProductByIdQuery(id))
      .then((result) => {
        if (!active) return;
        if (!result) {
          setNotFound(true);
          return;
        }
        setProduct(result);
        setNewPrice(String(result.salePrice.amount));
      })
      .catch(() => { if (active) setError('No fue posible cargar el producto.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const parsedNewPrice = Number(newPrice);
  const delta = product && Number.isFinite(parsedNewPrice) ? parsedNewPrice - product.salePrice.amount : 0;

  const insights = useMemo<readonly IntelligenceInsight[]>(() => {
    if (!product) return [];
    const items: IntelligenceInsight[] = [];
    if (!reason.trim()) items.push({ id: 'reason', severity: 'WARNING', title: 'Motivo requerido para trazabilidad', explanation: 'El cambio de precio debe registrar una razón entendible. El historial no debería contener cambios sin contexto.', source: 'Pricing audit' });
    if (Number.isFinite(parsedNewPrice) && parsedNewPrice === product.salePrice.amount) items.push({ id: 'same', severity: 'INFO', title: 'El precio no cambia', explanation: 'No se debe crear un movimiento histórico si el nuevo valor es igual al actual.', source: 'Pricing command' });
    if (Number.isFinite(parsedNewPrice) && parsedNewPrice < 0) items.push({ id: 'negative', severity: 'CRITICAL', title: 'Precio inválido', explanation: 'El precio de venta no puede ser negativo.', source: 'Domain validation' });
    if (items.length === 0) items.push({ id: 'ready', severity: 'SUCCESS', title: 'Cambio preparado para historial', explanation: `El cambio ${delta >= 0 ? 'aumenta' : 'reduce'} el precio en ${formatMoney(Math.abs(delta))}. Se registrará mediante el flujo de pricing, no editando Product Master directamente.`, source: 'Pricing' });
    return items;
  }, [delta, parsedNewPrice, product, reason]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!id || !canChangePrice) {
      setError('El cambio de precio controlado no está habilitado para esta sesión.');
      return;
    }
    const numericPrice = Number(newPrice);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setError('Ingresa un precio válido mayor o igual a 0.');
      return;
    }
    if (!reason.trim()) {
      setError('Registra un motivo para conservar una trazabilidad útil.');
      return;
    }

    setSubmitting(true);
    try {
      const commandId = crypto.randomUUID();
      await productsComposition.changeProductSalePrice.execute(
        createChangeProductSalePriceCommand({
          commandId,
          operationKey: `product-pricing:change:${commandId}`,
          actorId: auth.user?.id ?? 'authenticated-session',
          requestedAt: new Date(),
          productId: id,
          newPrice: numericPrice,
          reason: reason.trim(),
        }),
      );
      navigate(`/products/${id}`);
    } catch (caught) {
      if (caught instanceof ProductNotFoundError) setNotFound(true);
      else if (caught instanceof ProductSalePriceUnchangedError) setError('El nuevo precio debe ser diferente al precio actual.');
      else if (caught instanceof ProductWriteBlockedError) setError('El cambio de precio controlado permanece bloqueado en este entorno.');
      else setError('No fue posible cambiar el precio del producto.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <AdminPageHero
        eyebrow="PRODUCT PRICING"
        title="Cambiar precio"
        description="Registra un nuevo precio mediante un comando separado para preservar el historial y evitar sobrescribir la historia comercial."
        accent="lime"
        actions={<Link className="button-link button-link--secondary" to={id ? `/products/${id}` : '/products'}>← Detalle</Link>}
        status={<span className="status-badge">APPEND-ONLY HISTORY</span>}
      />

      <OperationalNotice title="El precio no se edita como un campo común" tone="info">
        <p>Cada cambio conserva precio anterior, precio nuevo, motivo, actor y fecha cuando la fuente persistente está habilitada.</p>
      </OperationalNotice>

      {product ? (
        <SummaryStrip items={[
          { label: 'Producto', value: product.name },
          { label: 'Actual', value: formatMoney(product.salePrice.amount) },
          { label: 'Nuevo', value: Number.isFinite(parsedNewPrice) ? formatMoney(parsedNewPrice) : '—' },
          { label: 'Diferencia', value: Number.isFinite(parsedNewPrice) ? `${delta >= 0 ? '+' : '-'}${formatMoney(Math.abs(delta))}` : '—' },
        ]} />
      ) : null}

      <IntelligencePanel insights={insights} />

      {loading ? <div className="empty-state">Cargando producto…</div> : null}
      {notFound && !loading ? <div className="empty-state"><strong>Producto no encontrado.</strong></div> : null}

      {!loading && !notFound && product ? (
        <form className="product-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label><span>Nuevo precio (COP)</span><input type="number" min="0" step="1" value={newPrice} onChange={(event) => setNewPrice(event.target.value)} disabled={!canChangePrice || submitting} required /></label>
            <label className="form-grid__wide"><span>Motivo del cambio</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={!canChangePrice || submitting} required rows={4} placeholder="Ej. ajuste por costo de proveedor, promoción finalizada o actualización comercial aprobada" /></label>
          </div>
          {!canChangePrice ? <div className="warning-state"><strong>Pricing protegido.</strong><p>La operación requiere sesión autorizada y el modo controlado correspondiente.</p></div> : null}
          {error ? <div className="error-state" role="alert">{error}</div> : null}
          <div className="form-actions">
            <Link className="button-link button-link--secondary" to={id ? `/products/${id}` : '/products'}>Cancelar</Link>
            <button type="submit" disabled={!canChangePrice || submitting}>{submitting ? 'Registrando…' : 'Registrar cambio de precio'}</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
