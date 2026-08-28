import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { FinancialAccount } from '@lihen/finance';
import { isOrderEligibleForSale, type Order } from '@lihen/orders';
import { evaluateSaleReversalPolicy, type Sale } from '@lihen/sales';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { financeComposition } from '../composition/finance';
import { inventoryComposition } from '../composition/inventory';
import { ordersComposition } from '../composition/orders';
import { productsComposition } from '../composition/products';
import { salesComposition } from '../composition/sales';
import { evaluateCommerceReadiness } from '../domain/commerce-readiness';
import { reconcileCommerceFlow, type CommerceReconciliationResult } from '../domain/commerce-reconciliation';
import { reconcileCancelledOrder, type OrderCancellationReconciliationResult } from '../domain/order-cancellation-reconciliation';


interface CommerceCheck {
  readonly saleId: string;
  readonly saleNumber: string;
  readonly orderNumber: string | null;
  readonly result: CommerceReconciliationResult;
}

interface CancellationCheck {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly result: OrderCancellationReconciliationResult;
}

interface PosLine {
  readonly key: string;
  readonly productId: string;
  readonly quantity: string;
  readonly unitPrice: string;
}

const salesChannels = ['IN_PERSON', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'WEB', 'OTHER'] as const;

function createEmptyLine(): PosLine {
  return { key: crypto.randomUUID(), productId: '', quantity: '1', unitPrice: '' };
}

export function SalesPage() {
  const [sales, setSales] = useState<readonly Sale[]>([]);
  const [accounts, setAccounts] = useState<readonly FinancialAccount[]>([]);
  const [orders, setOrders] = useState<readonly Order[]>([]);
  const [products, setProducts] = useState<readonly { id: string; name: string; sku: string | null; salePrice: number }[]>([]);
  const [number, setNumber] = useState('');
  const [accountId, setAccountId] = useState('');
  const [channel, setChannel] = useState('IN_PERSON');
  const [customer, setCustomer] = useState('');
  const [lines, setLines] = useState<PosLine[]>([createEmptyLine()]);
  const [orderId, setOrderId] = useState('');
  const [orderSaleNumber, setOrderSaleNumber] = useState('');
  const [orderAccountId, setOrderAccountId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [commerceChecks, setCommerceChecks] = useState<readonly CommerceCheck[]>([]);
  const [cancellationChecks, setCancellationChecks] = useState<readonly CancellationCheck[]>([]);

  async function refresh() {
    const [nextSales, nextAccounts, nextOrders, nextProducts] = await Promise.all([
      salesComposition.repository.list(),
      financeComposition.repository.listAccounts(),
      ordersComposition.getOrders.execute(),
      productsComposition.repository.findAll(),
    ]);

    const activeAccounts = nextAccounts.filter((account) => account.status === 'ACTIVE');
    const salesForIntegrity = nextSales.filter((sale) => sale.status === 'COMPLETED').slice(0, 25);
    const saleIds = salesForIntegrity.map((sale) => sale.id);
    const cancelledOrdersForIntegrity = nextOrders.filter((order) => order.status === 'CANCELLED').slice(0, 25);
    const cancelledOrderNumbers = cancelledOrdersForIntegrity.map((order) => order.orderNumber);
    const [saleItems, inventoryMovements, financialMovements, cancellationMovements, cancelledOrderItems] = await Promise.all([
      salesComposition.repository.listItemsBySaleIds(saleIds),
      inventoryComposition.repository.listMovementsByExternalReferences(saleIds),
      financeComposition.repository.listMovementsByReferences('SALE', saleIds),
      inventoryComposition.repository.listMovementsByExternalReferences(cancelledOrderNumbers),
      Promise.all(cancelledOrdersForIntegrity.map((order) => ordersComposition.repository.listItems(order.id))),
    ]);

    setCommerceChecks(salesForIntegrity.map((sale) => {
      const order = sale.orderId ? nextOrders.find((candidate) => candidate.id === sale.orderId) ?? null : null;
      return {
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        orderNumber: order?.orderNumber ?? null,
        result: reconcileCommerceFlow({
          sale,
          order,
          saleItems: saleItems.filter((item) => item.saleId === sale.id),
          inventoryMovements: inventoryMovements.filter((movement) => movement.externalReference === sale.id),
          financialMovements: financialMovements.filter((movement) => movement.referenceId === sale.id),
        }),
      };
    }));


    setCancellationChecks(cancelledOrdersForIntegrity.map((order, index) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      result: reconcileCancelledOrder({
        order,
        orderItems: cancelledOrderItems[index] ?? [],
        inventoryMovements: cancellationMovements.filter((movement) => movement.externalReference === order.orderNumber),
        sale: nextSales.find((sale) => sale.orderId === order.id) ?? null,
      }),
    })));

    setSales(nextSales);
    setAccounts(activeAccounts);
    setOrders(nextOrders.filter((order) => isOrderEligibleForSale(order.status)));
    setProducts(nextProducts.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku ?? null,
      salePrice: product.salePrice.amount,
    })));

    if (activeAccounts.length > 0) {
      setAccountId((current) => current || activeAccounts[0]!.id);
      setOrderAccountId((current) => current || activeAccounts[0]!.id);
    }
  }

  useEffect(() => {
    refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar ventas.'));
  }, []);

  function updateLine(key: string, patch: Partial<PosLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function chooseProduct(key: string, productId: string) {
    const product = products.find((candidate) => candidate.id === productId);
    updateLine(key, { productId, unitPrice: product ? String(product.salePrice) : '' });
  }

  async function submitPos(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await salesComposition.repository.createPos({
        operationKey: `pos-sale:${crypto.randomUUID()}`,
        saleId: salesComposition.ids.generate(),
        saleNumber: number,
        financialAccountId: accountId,
        channel,
        customerName: customer.trim() || null,
        customerPhone: null,
        occurredAt: new Date(),
        notes: null,
        items: lines.map((line) => ({
          id: salesComposition.ids.generate(),
          productId: line.productId,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        })),
      });
      setMessage('Venta POS completada. Inventario y finanzas se actualizaron mediante una sola operación controlada.');
      setNumber('');
      setCustomer('');
      setLines([createEmptyLine()]);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible registrar la venta POS.');
    }
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const selectedOrder = orders.find((order) => order.id === orderId);
      if (!selectedOrder || !isOrderEligibleForSale(selectedOrder.status)) {
        throw new Error('LIHEN_ORDER_NOT_ELIGIBLE_FOR_SALE');
      }
      await salesComposition.repository.completeOrder({
        operationKey: `order-sale:${crypto.randomUUID()}`,
        saleId: salesComposition.ids.generate(),
        saleNumber: orderSaleNumber,
        orderId,
        financialAccountId: orderAccountId,
        occurredAt: new Date(),
        notes: null,
      });
      setMessage('Pedido convertido en venta. La reserva, el inventario y el ingreso quedaron conciliados por el flujo controlado.');
      setOrderId('');
      setOrderSaleNumber('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible completar la venta del pedido.');
    }
  }

  const completedSales = sales.filter((sale) => sale.status === 'COMPLETED');
  const reversedSales = sales.filter((sale) => sale.status === 'REVERSED');
  const totalCompleted = completedSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const posDraftTotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);
  const blockedCommerceChecks = commerceChecks.filter((check) => check.result.status === 'BLOCKED');
  const reviewCommerceChecks = commerceChecks.filter((check) => check.result.status === 'REVIEW');
  const blockedCancellationChecks = cancellationChecks.filter((check) => check.result.status === 'BLOCKED');
  const commerceReadiness = evaluateCommerceReadiness({
    saleReconciliations: commerceChecks.map((check) => check.result),
    cancellationReconciliations: cancellationChecks.map((check) => check.result),
    reversedSaleCount: reversedSales.length,
    activeFinancialAccountCount: accounts.length,
  });

  const insights = useMemo<readonly IntelligenceInsight[]>(() => {
    const next: IntelligenceInsight[] = [];
    if (accounts.length === 0) {
      next.push({
        id: 'sales-no-account',
        severity: 'WARNING',
        title: 'No hay una cuenta financiera activa',
        explanation: 'Ventas necesita una cuenta activa para registrar el ingreso dentro del ledger financiero.',
        actionLabel: 'Revisar finanzas',
        targetRoute: '/finance',
        source: 'Cuentas financieras',
      });
    }
    if (orders.length > 0) {
      next.push({
        id: 'sales-orders-ready',
        severity: 'INFO',
        title: `${orders.length} pedido${orders.length === 1 ? '' : 's'} puede${orders.length === 1 ? '' : 'n'} convertirse en venta`,
        explanation: 'Completar la venta desde el pedido conserva la trazabilidad entre reserva, salida de inventario e ingreso financiero.',
        source: 'Pedidos elegibles',
      });
    }
    if (products.length === 0) {
      next.push({
        id: 'sales-no-products',
        severity: 'WARNING',
        title: 'No hay productos disponibles para POS',
        explanation: 'La venta rápida necesita Product Master disponible antes de registrar líneas.',
        actionLabel: 'Revisar productos',
        targetRoute: '/products',
        source: 'Product Master',
      });
    }
    if (blockedCancellationChecks.length > 0) {
      next.push({
        id: 'commerce-cancellation-blocked',
        severity: 'CRITICAL',
        title: `${blockedCancellationChecks.length} cancelación${blockedCancellationChecks.length === 1 ? '' : 'es'} con liberación inconsistente`,
        explanation: 'Una cancelación no puede dejar reservas activas ni coexistir con una venta completada. Investiga el ledger por referencia del pedido antes de ajustar stock.',
        actionLabel: 'Revisar pedidos',
        targetRoute: '/orders',
        source: 'Order cancellation reconciliation',
      });
    }
    if (reversedSales.length > 0) {
      next.push({
        id: 'sales-reversed-audit',
        severity: 'WARNING',
        title: `${reversedSales.length} venta${reversedSales.length === 1 ? '' : 's'} figura${reversedSales.length === 1 ? '' : 'n'} como REVERSED`,
        explanation: 'REVERSED se trata como evidencia histórica. No existe en esta UI un reverso genérico de SALE_INCOME ni una compensación automática de inventario.',
        source: 'Sale reversal policy',
      });
    }

    if (blockedCommerceChecks.length > 0) {
      next.push({
        id: 'commerce-integrity-blocked',
        severity: 'CRITICAL',
        title: `${blockedCommerceChecks.length} venta${blockedCommerceChecks.length === 1 ? '' : 's'} con conciliación bloqueada`,
        explanation: 'Order, salida de inventario o SALE_INCOME no coincide con la venta canónica. La señal es read-only: investigar el rastro antes de cualquier corrección.',
        actionLabel: 'Revisar integridad',
        targetRoute: '/operations',
        source: 'Commerce reconciliation',
      });
    } else if (commerceChecks.length > 0) {
      next.push({
        id: 'commerce-integrity-pass',
        severity: reviewCommerceChecks.length > 0 ? 'WARNING' : 'SUCCESS',
        title: reviewCommerceChecks.length > 0 ? `${reviewCommerceChecks.length} venta${reviewCommerceChecks.length === 1 ? '' : 's'} requiere${reviewCommerceChecks.length === 1 ? '' : 'n'} revisión` : 'Commerce conciliado en la muestra reciente',
        explanation: 'Se contrastaron venta, pedido cuando aplica, movimientos de inventario e ingreso financiero por referencia canónica.',
        source: 'Order + Sale + Inventory + Finance',
      });
    }
    if (next.length === 0) {
      next.push({
        id: 'sales-ready',
        severity: 'SUCCESS',
        title: 'POS listo para operar bajo controles actuales',
        explanation: 'Hay productos y cuenta financiera activa. Cada venta seguirá pasando por la operación controlada del dominio.',
        source: 'Ventas + Inventario + Finanzas',
      });
    }
    return next;
  }, [accounts.length, blockedCancellationChecks.length, blockedCommerceChecks.length, commerceChecks.length, orders.length, products.length, reversedSales.length, reviewCommerceChecks.length]);

  return (
    <section className="stack">
      <AdminPageHero
        eyebrow="COMERCIO"
        title="Ventas / POS"
        description="Completa pedidos o registra ventas directas sin separar artificialmente inventario y finanzas: una venta válida conserva todo el rastro de dominio."
        accent="pink"
        status={<><strong>{salesComposition.canWrite ? 'Operación controlada disponible' : 'Escritura bloqueada'}</strong><p>La UI no modifica saldos ni stock directamente.</p></>}
      />

      <SummaryStrip items={[
        { label: 'Ventas', value: sales.length, detail: 'historial canónico' },
        { label: 'Completadas', value: completedSales.length, detail: `$${totalCompleted.toLocaleString('es-CO')}` },
        { label: 'Revertidas', value: reversedSales.length, detail: 'historia conservada' },
        { label: 'Pedidos elegibles', value: orders.length, detail: 'confirmados / preparando / listos' },
        { label: 'Cuentas activas', value: accounts.length, detail: 'destino de ingreso' },
        { label: 'Integridad Commerce', value: commerceReadiness.status, detail: commerceReadiness.status === 'READY' ? 'flujo conciliado' : `${commerceReadiness.blockers.length} bloqueos · ${commerceReadiness.warnings.length} alertas` },
      ]} />

      <OperationalNotice title="Venta atómica y trazable" tone="warning" meta="Inventario + Finanzas + Auditoría">
        <p>Una venta completada descuenta inventario y registra el ingreso mediante el flujo controlado. No migres ventas ni saldos legacy manualmente desde esta pantalla.</p>
      </OperationalNotice>


      <OperationalNotice title="Reversos: requieren un workflow de dominio dedicado" tone="info" meta="No usar reverso financiero genérico">
        <p>SALE_INCOME no se revierte desde Finanzas como si fuera un gasto. Revertir una venta tendría que compensar venta, inventario, reserva cuando aplique, ingreso financiero y auditoría en una sola operación controlada. Mientras ese workflow no exista, la UI no ofrece la acción.</p>
      </OperationalNotice>

      <IntelligencePanel insights={insights} />


      <div className="card stack">
        <div>
          <span className="eyebrow">INTEGRIDAD READ-ONLY</span>
          <h2>Order → Sale → Inventory → Finance</h2>
          <p>La muestra reciente contrasta referencias canónicas. Un mismatch no se corrige desde esta tabla ni se compensa con ajustes manuales.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Venta</th><th>Pedido</th><th>Estado</th><th>Unidades</th><th>ON_HAND</th><th>RESERVED</th><th>Ingreso</th><th>Señales</th></tr></thead>
            <tbody>{commerceChecks.map((check) => (
              <tr key={check.saleId}>
                <td><strong>{check.saleNumber}</strong></td>
                <td>{check.orderNumber ?? 'POS directo'}</td>
                <td>{check.result.status}</td>
                <td>{check.result.inventoryExpectedUnits}</td>
                <td>{check.result.inventoryOnHandUnits}</td>
                <td>{check.result.inventoryReservedUnits}</td>
                <td>${check.result.financeIncomeAmount.toLocaleString('es-CO')}</td>
                <td>{[...check.result.blockers, ...check.result.warnings].join(', ') || 'Sin diferencias'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {commerceChecks.length === 0 ? <p>No hay ventas completadas recientes para conciliar. El estado vacío es válido.</p> : null}
      </div>

      <div className="card stack">
        <div>
          <span className="eyebrow">CANCELACIONES READ-ONLY</span>
          <h2>Pedido cancelado → reserva liberada</h2>
          <p>Una cancelación desde DRAFT no necesita movimiento. Si el pedido tuvo reserva, RESERVED debe quedar liberado por la misma referencia comercial.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pedido</th><th>Estado</th><th>Unidades pedido</th><th>Reserva creada</th><th>Reserva liberada</th><th>Señales</th></tr></thead>
            <tbody>{cancellationChecks.map((check) => (
              <tr key={check.orderId}>
                <td><strong>{check.orderNumber}</strong></td>
                <td>{check.result.status}</td>
                <td>{check.result.expectedUnits}</td>
                <td>{check.result.reservedUnitsCreated}</td>
                <td>{check.result.reservedUnitsReleased}</td>
                <td>{[...check.result.blockers, ...check.result.warnings].join(', ') || 'Sin diferencias'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {cancellationChecks.length === 0 ? <p>No hay cancelaciones recientes para conciliar. El estado vacío es válido.</p> : null}
      </div>

      {message ? <div className="info-state">{message}</div> : null}
      {error ? <div className="error-state">{error}</div> : null}

      {salesComposition.canWrite && accounts.length > 0 ? (
        <>
          <form className="card stack" onSubmit={submitOrder}>
            <div>
              <span className="eyebrow">FLUJO DESDE PEDIDO</span>
              <h2>Completar pedido como venta</h2>
              <p>Usa este flujo cuando el pedido ya existe y debe conservar su relación con la reserva de inventario.</p>
            </div>
            <div className="form-grid">
              <label><span>Pedido</span><select required value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">Seleccionar…</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.customerName ?? 'Sin cliente'}</option>)}</select></label>
              <label><span>Número de venta</span><input required value={orderSaleNumber} onChange={(event) => setOrderSaleNumber(event.target.value)} /></label>
              <label><span>Cuenta de ingreso</span><select required value={orderAccountId} onChange={(event) => setOrderAccountId(event.target.value)}><option value="">Seleccionar…</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            </div>
            <button type="submit">Completar venta</button>
          </form>

          <form className="card stack" onSubmit={submitPos}>
            <div>
              <span className="eyebrow">VENTA DIRECTA</span>
              <h2>Venta rápida / POS</h2>
              <p>Registra una venta sin pedido previo. El precio parte del Product Master y puede ajustarse antes de confirmar la operación.</p>
            </div>
            <div className="form-grid">
              <label><span>Número de venta</span><input required value={number} onChange={(event) => setNumber(event.target.value)} /></label>
              <label><span>Cuenta de ingreso</span><select required value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Seleccionar…</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
              <label><span>Canal</span><select value={channel} onChange={(event) => setChannel(event.target.value)}>{salesChannels.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}</select></label>
              <label><span>Cliente</span><input value={customer} onChange={(event) => setCustomer(event.target.value)} /></label>
            </div>

            {lines.map((line, index) => (
              <div className="form-grid" key={line.key}>
                <label><span>Producto {index + 1}</span><select required value={line.productId} onChange={(event) => chooseProduct(line.key, event.target.value)}><option value="">Seleccionar…</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku ? `${product.sku} · ` : ''}{product.name}</option>)}</select></label>
                <label><span>Cantidad</span><input required type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} /></label>
                <label><span>Precio unitario</span><input required type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })} /></label>
                {lines.length > 1 ? <button type="button" onClick={() => setLines((current) => current.filter((candidate) => candidate.key !== line.key))}>Quitar</button> : null}
              </div>
            ))}

            <div className="toolbar">
              <button type="button" onClick={() => setLines((current) => [...current, createEmptyLine()])}>Agregar producto</button>
              <strong>Total preparado: ${posDraftTotal.toLocaleString('es-CO')}</strong>
              <button type="submit">Completar venta POS</button>
            </div>
          </form>
        </>
      ) : (
        <OperationalNotice title="Venta bloqueada por precondiciones" tone="warning">
          <p>Para registrar ventas debe existir al menos una cuenta financiera activa y el modo de escritura controlada debe estar habilitado.</p>
        </OperationalNotice>
      )}

      <div className="card stack">
        <div><span className="eyebrow">HISTORIAL</span><h2>Ventas registradas</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Número</th><th>Fecha</th><th>Canal</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Reverso</th></tr></thead>
            <tbody>{sales.map((sale) => { const reversal = evaluateSaleReversalPolicy(sale); return <tr key={sale.id}><td><strong>{sale.saleNumber}</strong></td><td>{sale.occurredAt.toLocaleString()}</td><td>{sale.channel}</td><td>{sale.customerName ?? '—'}</td><td>${sale.totalAmount.toLocaleString('es-CO')}</td><td>{sale.status}</td><td>{reversal.capability === 'HISTORICAL_REVERSED' ? 'Histórico · auditar' : 'Workflow dedicado requerido'}</td></tr>; })}</tbody>
          </table>
        </div>
        {sales.length === 0 ? <p>No hay ventas canónicas todavía. El estado vacío es válido mientras no se haya ejecutado ninguna venta controlada.</p> : null}
      </div>
    </section>
  );
}
