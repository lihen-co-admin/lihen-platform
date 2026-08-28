import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { isOrderEligibleForSale, orderChannels, type Order, type OrderChannel } from '@lihen/orders';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { ordersComposition } from '../composition/orders';
import { productsComposition } from '../composition/products';

interface DraftLine {
  readonly key: string;
  readonly productId: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly notes: string;
}

const createDraftLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  productId: '',
  quantity: '1',
  unitPrice: '',
  notes: '',
});

const orderStatusLabel: Record<Order['status'], string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  READY: 'Listo',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const orderChannelLabel: Record<OrderChannel, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  TIKTOK: 'TikTok',
  WEB: 'Web',
  IN_PERSON: 'Presencial',
  OTHER: 'Otro',
};

export function OrdersPage() {
  const [rows, setRows] = useState<readonly Order[]>([]);
  const [products, setProducts] = useState<readonly { id: string; name: string; sku: string | null; salePrice: number }[]>([]);
  const [number, setNumber] = useState('');
  const [channel, setChannel] = useState<OrderChannel>('WHATSAPP');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([createDraftLine()]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    const [orders, productRows] = await Promise.all([
      ordersComposition.getOrders.execute(),
      productsComposition.repository.findAll(),
    ]);

    setRows(orders);
    setProducts(productRows.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku ?? null,
      salePrice: product.salePrice.amount,
    })));
  }

  useEffect(() => {
    refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar pedidos.'));
  }, []);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of rows) counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
    const active = rows.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status)).length;
    const saleEligible = rows.filter((order) => isOrderEligibleForSale(order.status)).length;

    return [
      { label: 'Pedidos', value: rows.length, detail: 'Registros canónicos' },
      { label: 'Borradores', value: counts.get('DRAFT') ?? 0, detail: 'Aún sin reserva' },
      { label: 'En curso', value: active, detail: 'Pendientes de cierre' },
      { label: 'Elegibles para venta', value: saleEligible, detail: 'Reserva activa' },
      { label: 'Completados', value: counts.get('COMPLETED') ?? 0, detail: 'Venta ya cerrada' },
    ];
  }, [rows]);

  const intelligenceInsights = useMemo<IntelligenceInsight[]>(() => {
    const drafts = rows.filter((order) => order.status === 'DRAFT').length;
    const confirmed = rows.filter((order) => order.status === 'CONFIRMED').length;
    const ready = rows.filter((order) => order.status === 'READY').length;
    const saleEligible = rows.filter((order) => isOrderEligibleForSale(order.status)).length;
    const insights: IntelligenceInsight[] = [];

    if (drafts > 0) {
      insights.push({
        id: 'orders-drafts',
        severity: 'INFO',
        title: `${drafts} pedido${drafts === 1 ? '' : 's'} en borrador`,
        explanation: 'Los borradores todavía no reservan existencia. Confírmalos únicamente cuando los datos comerciales y productos sean correctos.',
        source: 'Order Master',
      });
    }

    if (confirmed > 0) {
      insights.push({
        id: 'orders-confirmed',
        severity: 'WARNING',
        title: `${confirmed} pedido${confirmed === 1 ? '' : 's'} confirmado${confirmed === 1 ? '' : 's'} con reserva activa`,
        explanation: 'La existencia reservada reduce disponibilidad, pero ON_HAND no se descuenta hasta completar el flujo de venta correspondiente.',
        actionLabel: 'Revisar inventario',
        targetRoute: '/inventory',
        source: 'Pedidos + inventario',
      });
    }

    if (ready > 0) {
      insights.push({
        id: 'orders-ready',
        severity: 'SUCCESS',
        title: `${ready} pedido${ready === 1 ? '' : 's'} listo${ready === 1 ? '' : 's'} para el siguiente paso`,
        explanation: 'Estos pedidos ya llegaron al estado READY. La siguiente acción debe respetar el flujo de dominio y no forzarse desde inventario o finanzas.',
        source: 'Order workflow',
      });
    }


    if (saleEligible > 0) {
      insights.push({
        id: 'orders-sale-eligible',
        severity: 'INFO',
        title: `${saleEligible} pedido${saleEligible === 1 ? '' : 's'} elegible${saleEligible === 1 ? '' : 's'} para venta`,
        explanation: 'CONFIRMED, PREPARING y READY conservan una reserva activa. El cierre correcto ocurre desde Ventas/POS, donde se consume la reserva, sale ON_HAND y se registra el ingreso.',
        actionLabel: 'Ir a Ventas / POS',
        targetRoute: '/sales',
        source: 'Order commerce policy',
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: 'orders-stable',
        severity: 'SUCCESS',
        title: 'Sin pedidos activos que requieran atención inmediata',
        explanation: 'La lectura actual no detecta borradores, confirmados ni pedidos listos pendientes.',
        source: 'Pedidos canónicos',
      });
    }

    return insights;
  }, [rows]);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function chooseProduct(key: string, productId: string) {
    const product = products.find((candidate) => candidate.id === productId);
    updateLine(key, { productId, unitPrice: product ? String(product.salePrice) : '' });
  }

  async function confirmOrder(order: Order) {
    setError('');
    setMessage('');
    try {
      await ordersComposition.confirm.execute({
        operationKey: `order-confirm:${crypto.randomUUID()}`,
        orderId: order.id,
        occurredAt: new Date(),
      });
      setMessage('Pedido confirmado y existencia reservada. ON_HAND no se descuenta todavía.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible confirmar el pedido.');
    }
  }

  async function cancelOrder(order: Order) {
    const reason = window.prompt('Motivo de cancelación (obligatorio para trazabilidad):');
    if (reason === null) return;
    setError('');
    setMessage('');
    if (!reason.trim()) {
      setError('Se requiere un motivo de cancelación para conservar evidencia operativa.');
      return;
    }
    try {
      await ordersComposition.cancel.execute({
        operationKey: `order-cancel:${crypto.randomUUID()}`,
        orderId: order.id,
        occurredAt: new Date(),
        reason: reason.trim(),
      });
      setMessage('Pedido cancelado. Si tenía reserva, la existencia disponible fue liberada.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cancelar el pedido.');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await ordersComposition.createDraft.execute({
        operationKey: `order-draft:${crypto.randomUUID()}`,
        orderId: ordersComposition.ids.generate(),
        orderNumber: number,
        channel,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        notes: notes.trim() || null,
        requestedAt: new Date(),
        items: lines.map((line) => ({
          id: ordersComposition.ids.generate(),
          productId: line.productId,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          notes: line.notes.trim() || null,
        })),
      });

      setNumber('');
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setLines([createDraftLine()]);
      setMessage('Pedido guardado como borrador. Todavía no reserva inventario ni mueve caja.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible crear el pedido.');
    }
  }

  return (
    <section className="stack orders-page">
      <AdminPageHero
        eyebrow="COMERCIO"
        title="Pedidos"
        description="Centraliza solicitudes de clientes, conserva el precio capturado y avanza cada pedido por un workflow trazable antes de impactar inventario o finanzas."
        accent="pink"
        status={<span className={`status-badge ${ordersComposition.canWrite ? 'status-badge--success' : 'status-badge--warning'}`}>{ordersComposition.canWrite ? 'OPERACIÓN CONTROLADA' : 'SOLO LECTURA'}</span>}
      />

      <SummaryStrip items={summary} />

      <IntelligencePanel
        title="Lectura operativa de pedidos"
        description="Detecta estados que requieren atención y explica su efecto sobre reservas sin ejecutar acciones automáticamente."
        insights={intelligenceInsights}
      />

      <OperationalNotice title="Reserva no significa venta completada" tone="info" meta="Borrador → confirmación/reserva → preparación → cierre">
        <p>Un pedido en borrador no reserva existencia. Al confirmarlo se protege disponibilidad, pero el descuento físico y el ingreso financiero corresponden al flujo de venta.</p>
      </OperationalNotice>


      <OperationalNotice title="Cancelar libera reserva; no revierte ventas" tone="warning" meta="Motivo obligatorio en Control Center">
        <p>Un pedido activo puede cancelarse y liberar RESERVED. Un pedido ya COMPLETED no se cancela para deshacer la venta: cualquier reverso comercial necesita su propio workflow atómico y auditable.</p>
      </OperationalNotice>

      {ordersComposition.canWrite ? (
        <form className="card stack admin-form-card" onSubmit={submit}>
          <div className="card-heading">
            <div>
              <span className="card-label">Nueva operación</span>
              <h2>Nuevo pedido en borrador</h2>
            </div>
            <span className="line-badge">DRAFT</span>
          </div>

          <div className="form-grid">
            <label>
              <span>Número / referencia</span>
              <input required value={number} onChange={(event) => setNumber(event.target.value)} />
            </label>
            <label>
              <span>Canal</span>
              <select value={channel} onChange={(event) => setChannel(event.target.value as OrderChannel)}>
                {orderChannels.map((candidate) => <option key={candidate} value={candidate}>{orderChannelLabel[candidate]}</option>)}
              </select>
            </label>
            <label>
              <span>Cliente</span>
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <label>
              <span>Teléfono</span>
              <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            </label>
            <label className="form-field--wide">
              <span>Notas</span>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>

          <div className="card-heading">
            <div>
              <span className="card-label">Detalle</span>
              <h3>Productos del pedido</h3>
            </div>
            <span className="line-badge">{lines.length} línea{lines.length === 1 ? '' : 's'}</span>
          </div>

          {lines.map((line, index) => (
            <div className="form-grid workflow-line" key={line.key}>
              <label>
                <span>Producto {index + 1}</span>
                <select required value={line.productId} onChange={(event) => chooseProduct(line.key, event.target.value)}>
                  <option value="">Seleccionar…</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.sku ? `${product.sku} · ` : ''}{product.name}</option>)}
                </select>
              </label>
              <label>
                <span>Cantidad</span>
                <input required type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} />
              </label>
              <label>
                <span>Precio unitario</span>
                <input required type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })} />
              </label>
              <label>
                <span>Nota del producto</span>
                <input value={line.notes} onChange={(event) => updateLine(line.key, { notes: event.target.value })} />
              </label>
              {lines.length > 1 ? <button className="button-ghost workflow-line__remove" type="button" onClick={() => setLines((current) => current.filter((candidate) => candidate.key !== line.key))}>Quitar</button> : null}
            </div>
          ))}

          <div className="form-actions form-actions--between">
            <button className="button-ghost" type="button" onClick={() => setLines((current) => [...current, createDraftLine()])}>Agregar producto</button>
            <button type="submit">Guardar borrador</button>
          </div>
        </form>
      ) : (
        <OperationalNotice title="Escritura de pedidos bloqueada" tone="warning">
          <p>La lectura permanece disponible. Crear, confirmar o cancelar requiere el modo controlado y la autorización correspondiente.</p>
        </OperationalNotice>
      )}

      {message ? <OperationalNotice title="Operación completada" tone="success"><p>{message}</p></OperationalNotice> : null}
      {error ? <div className="error-state">{error}</div> : null}

      <section className="table-card">
        <div className="table-summary">
          <div>
            <span className="card-label">Workflow comercial</span>
            <h2>Pedidos registrados</h2>
          </div>
          <span>{rows.length} registro{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Número</th><th>Cliente</th><th>Canal</th><th>Estado</th><th>Solicitud</th><th className="align-right">Acciones</th></tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.orderNumber}</strong></td>
                  <td>{order.customerName ?? '—'}</td>
                  <td>{orderChannelLabel[order.channel]}</td>
                  <td><span className={`workflow-status workflow-status--${order.status.toLowerCase()}`}>{orderStatusLabel[order.status]}</span></td>
                  <td>{order.requestedAt?.toLocaleString() ?? '—'}</td>
                  <td className="align-right">
                    <div className="row-actions">
                      {order.status === 'DRAFT' && ordersComposition.canWrite ? <button className="table-action" type="button" onClick={() => void confirmOrder(order)}>Confirmar</button> : null}
                      {!['COMPLETED', 'CANCELLED'].includes(order.status) && ordersComposition.canWrite ? <button className="table-action table-action--danger" type="button" onClick={() => void cancelOrder(order)}>Cancelar</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <div className="empty-state empty-state--embedded"><strong>Aún no hay pedidos canónicos</strong><p>Los pedidos aparecerán aquí desde su creación y conservarán su estado de workflow.</p></div> : null}
      </section>
    </section>
  );
}
