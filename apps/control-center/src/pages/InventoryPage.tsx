import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  INVENTORY_ADJUSTMENT_REASONS,
  evaluateInventoryAdjustmentPolicy,
  type InventoryAdjustmentReason,
  type InventoryBalance,
  type InventoryMovement,
} from '@lihen/inventory';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { inventoryComposition } from '../composition/inventory';
import { procurementComposition } from '../composition/procurement';
import { productsComposition } from '../composition/products';
import { evaluateSupplyInventoryReadiness } from '../domain/supply-inventory-readiness';

const reasonLabels: Record<InventoryAdjustmentReason, string> = {
  PHYSICAL_COUNT_INCREASE: 'Conteo físico: aumento',
  PHYSICAL_COUNT_DECREASE: 'Conteo físico: disminución',
  DAMAGE_WRITE_OFF: 'Baja por daño',
  LOSS_WRITE_OFF: 'Baja por pérdida',
  RETURN_TO_STOCK: 'Retorno a inventario',
  MANUAL_CORRECTION: 'Corrección manual documentada',
};

const bucketLabels = { ON_HAND: 'Existencia física', RESERVED: 'Reservado', PENDING_IN: 'Pendiente de ingreso' } as const;

export function InventoryPage() {
  const [balances, setBalances] = useState<readonly InventoryBalance[]>([]);
  const [products, setProducts] = useState<readonly { id: string; name: string; sku: string | null }[]>([]);
  const [supplyReadiness, setSupplyReadiness] = useState<ReturnType<typeof evaluateSupplyInventoryReadiness> | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [traceProductId, setTraceProductId] = useState('');
  const [movements, setMovements] = useState<readonly InventoryMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<InventoryAdjustmentReason>('PHYSICAL_COUNT_INCREASE');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [nextBalances, nextProducts, purchases] = await Promise.all([
      inventoryComposition.getInventory.execute(), productsComposition.repository.findAll(), procurementComposition.getPurchases.execute(),
    ]);
    const itemEntries = await Promise.all(purchases.map(async (purchase) => [
      purchase.id, await procurementComposition.repository.listItems(purchase.id),
    ] as const));
    setBalances(nextBalances);
    setProducts(nextProducts.map((product) => ({ id: product.id, name: product.name, sku: product.sku ?? null })));
    setSupplyReadiness(evaluateSupplyInventoryReadiness(nextBalances, purchases, new Map(itemEntries), new Date().toISOString().slice(0, 10)));
  }

  useEffect(() => {
    refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar inventario.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!traceProductId) { setMovements([]); return; }
    setMovementsLoading(true);
    inventoryComposition.getMovements.execute(traceProductId)
      .then(setMovements)
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar movimientos.'))
      .finally(() => setMovementsLoading(false));
  }, [traceProductId]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return balances.map((balance) => ({ ...balance, product: productById.get(balance.productId) }))
      .filter((row) => !q || row.product?.name.toLowerCase().includes(q) || row.product?.sku?.toLowerCase().includes(q))
      .slice(0, 100);
  }, [balances, productById, query]);

  const totals = useMemo(() => balances.reduce((acc, item) => ({
    onHand: acc.onHand + item.stockOnHand,
    reserved: acc.reserved + item.stockReserved,
    pending: acc.pending + item.stockPending,
    available: acc.available + item.stockAvailable,
  }), { onHand: 0, reserved: 0, pending: 0, available: 0 }), [balances]);

  const insights = useMemo<readonly IntelligenceInsight[]>(() => {
    const next: IntelligenceInsight[] = [];
    if (totals.pending > 0) next.push({
      id: 'inventory-pending', severity: 'INFO', title: `${totals.pending} unidades pendientes de ingreso`,
      explanation: 'PENDING_IN se resuelve desde Compras y recepción física; Inventario no debe convertirlo manualmente en ON_HAND.',
      actionLabel: 'Abrir compras', targetRoute: '/purchases', source: 'ledger de inventario',
    });
    const unavailable = balances.filter((item) => item.stockAvailable <= 0 && item.stockOnHand > 0).length;
    if (unavailable > 0) next.push({
      id: 'inventory-reserved', severity: 'WARNING', title: `${unavailable} productos sin disponibilidad pese a tener existencia`,
      explanation: 'La reserva puede estar consumiendo el stock disponible. Revisa Pedidos antes de ajustar físicamente.',
      actionLabel: 'Abrir pedidos', targetRoute: '/orders', source: 'saldo derivado del ledger',
    });
    const negative = balances.filter((item) => item.stockOnHand < 0 || item.stockAvailable < 0 || item.stockPending < 0 || item.stockReserved < 0).length;
    if (negative > 0) next.push({
      id: 'inventory-negative', severity: 'CRITICAL', title: `${negative} saldos requieren revisión de integridad`,
      explanation: 'Un bucket negativo rompe los invariantes del ledger y debe investigarse antes de registrar nuevos ajustes.',
      actionLabel: 'Abrir integridad', targetRoute: '/operations', source: 'inventory_stock',
    });
    return next;
  }, [balances, totals.pending]);

  const adjustmentPolicy = useMemo(() => evaluateInventoryAdjustmentPolicy({
    quantityDelta: Number(quantity), reason, notes: notes.trim() || null,
  }), [notes, quantity, reason]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    const delta = Number(quantity);
    if (!selectedId) {
      setError('Selecciona el producto antes de registrar el ajuste.');
      return;
    }
    if (!adjustmentPolicy.allowed) {
      setError(adjustmentPolicy.blockers.join(' '));
      return;
    }
    if (supplyReadiness?.status === 'BLOCKED') {
      setError('El ajuste queda protegido mientras Supply & Inventory tenga bloqueos de integridad. Investiga la conciliación antes de registrar movimientos manuales.');
      return;
    }
    try {
      await inventoryComposition.recordAdjustment.execute({
        operationKey: `inventory-adjustment:${crypto.randomUUID()}`,
        movementId: inventoryComposition.ids.generate(), productId: selectedId, quantityDelta: delta,
        reason, occurredAt: new Date(), notes: notes.trim() || null,
      });
      setQuantity(''); setNotes(''); setMessage('Ajuste registrado en el ledger inmutable.');
      await refresh();
      if (traceProductId === selectedId) setMovements(await inventoryComposition.getMovements.execute(selectedId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible registrar el ajuste.');
    }
  }

  const tracedProduct = traceProductId ? productById.get(traceProductId) : null;

  return <section className="stack">
    <AdminPageHero title="Inventario" description="Existencia derivada de movimientos trazables. Compras origina pendientes de ingreso, Pedidos origina reservas y solo el conteo físico justifica ajustes manuales de ON_HAND." accent="lime" status={<span className={`status-badge ${inventoryComposition.canAdjustOnHand ? 'status-badge--success' : 'status-badge--warning'}`}>{inventoryComposition.canAdjustOnHand ? 'Ajuste controlado' : 'Ajuste bloqueado'}</span>} />
    <SummaryStrip items={[{ label: 'ON_HAND', value: totals.onHand }, { label: 'Disponible', value: totals.available }, { label: 'Reservado', value: totals.reserved }, { label: 'PENDING_IN', value: totals.pending }]} />
    <OperationalNotice title="Ledger como fuente de verdad" meta="Saldo = movimientos acumulados">No se sobrescriben saldos. RESERVED y PENDING_IN se originan en sus flujos de dominio; los ajustes manuales solo documentan diferencias físicas reales de ON_HAND.</OperationalNotice>
    {insights.length > 0 ? <IntelligencePanel title="Señales de inventario" description="Lectura read-only de dependencias, disponibilidad e integridad." insights={insights} /> : null}
    {supplyReadiness ? <OperationalNotice
      title={`Readiness Supply & Inventory: ${supplyReadiness.status}`}
      tone={supplyReadiness.status === 'READY' ? 'success' : supplyReadiness.status === 'REVIEW' ? 'warning' : 'critical'}
      meta={`Esperado PENDING_IN ${supplyReadiness.expectedPendingUnits} · ledger ${supplyReadiness.ledgerPendingUnits}`}
    >
      <p>{supplyReadiness.status === 'READY'
        ? 'Compras abiertas y PENDING_IN concilian a nivel agregado y no hay buckets negativos.'
        : [...supplyReadiness.blockers, ...supplyReadiness.warnings].join(' ')}</p>
    </OperationalNotice> : null}

    {inventoryComposition.canAdjustOnHand ? <form className="card stack admin-form-card" onSubmit={submit}>
      <div className="card-heading"><div><span className="card-label">Operación controlada</span><h2>Ajuste físico</h2></div><span className="status-badge">Solo ON_HAND</span></div>
      <div className="form-grid">
        <label><span>Producto</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} required><option value="">Seleccionar…</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku ? `${product.sku} · ` : ''}{product.name}</option>)}</select></label>
        <label><span>Cantidad (+ / -)</span><input type="number" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
        <label><span>Motivo</span><select value={reason} onChange={(event) => setReason(event.target.value as InventoryAdjustmentReason)}>{INVENTORY_ADJUSTMENT_REASONS.map((candidate) => <option key={candidate} value={candidate}>{reasonLabels[candidate]}</option>)}</select></label>
        <label><span>Nota / evidencia operativa</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={adjustmentPolicy.evidenceRequired ? 'Obligatoria para este motivo' : 'Opcional, pero recomendada'} /></label>
      </div>
      {!adjustmentPolicy.allowed && quantity !== '' ? <OperationalNotice title="Ajuste todavía no válido" tone="warning"><p>{adjustmentPolicy.blockers.join(' ')}</p></OperationalNotice> : null}
      {supplyReadiness?.status === 'BLOCKED' ? <OperationalNotice title="Ajustes protegidos por integridad" tone="critical"><p>Mientras exista una diferencia Compra ↔ PENDING_IN o un bucket negativo, los ajustes manuales permanecen bloqueados para no ocultar la causa raíz.</p></OperationalNotice> : null}
      <div className="form-actions"><button type="submit" disabled={!selectedId || !adjustmentPolicy.allowed || supplyReadiness?.status === 'BLOCKED'}>Registrar ajuste</button></div>
    </form> : <OperationalNotice title="Escritura bloqueada" tone="warning">La lectura permanece disponible. El ajuste físico solo se habilita mediante el modo controlado de DEV.</OperationalNotice>}

    {message ? <OperationalNotice title="Movimiento registrado" tone="success">{message}</OperationalNotice> : null}
    {error ? <div className="error-state" role="alert">{error}</div> : null}

    <div className="table-card">
      <div className="table-summary"><div><span className="card-label">Saldo derivado</span><h2>Existencias por producto</h2></div><span>Máximo 100 resultados por vista</span></div>
      <div className="table-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto o SKU" /></div>
      {loading ? <div className="loading-card loading-card--embedded"><span className="loading-spinner" /><div><strong>Cargando inventario</strong><p>Calculando saldos desde el ledger…</p></div></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Producto</th><th>ON_HAND</th><th>Reservado</th><th>Pendiente</th><th>Disponible</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.productId}><td><strong>{row.product?.name ?? row.productId}</strong><br /><small>{row.product?.sku ?? 'Sin SKU'}</small></td><td>{row.stockOnHand}</td><td>{row.stockReserved}</td><td>{row.stockPending}</td><td><strong>{row.stockAvailable}</strong></td><td className="align-right"><button type="button" className="table-action" onClick={() => setTraceProductId(row.productId)}>Ver movimientos</button></td></tr>)}</tbody></table></div>}
    </div>

    <div className="card stack">
      <div className="card-heading"><div><span className="card-label">Trazabilidad</span><h2>Movimientos del ledger</h2></div>{traceProductId ? <button type="button" className="button-link button-link--secondary" onClick={() => setTraceProductId('')}>Cerrar detalle</button> : null}</div>
      {!traceProductId ? <div className="empty-state empty-state--embedded"><strong>Selecciona un producto</strong><p>Usa “Ver movimientos” para inspeccionar el origen de su saldo sin modificarlo.</p></div> : movementsLoading ? <div className="loading-card loading-card--embedded"><span className="loading-spinner" /><div><strong>Cargando movimientos</strong><p>Reconstruyendo trazabilidad de {tracedProduct?.name ?? traceProductId}…</p></div></div> : <>
        <OperationalNotice title={tracedProduct?.name ?? traceProductId} meta={`${movements.length} movimiento${movements.length === 1 ? '' : 's'}`}>Cada fila representa un evento inmutable del ledger. La referencia externa permite relacionar compras, pedidos u otras operaciones de dominio cuando aplica.</OperationalNotice>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Fecha</th><th>Bucket</th><th>Delta</th><th>Motivo</th><th>Referencia</th><th>Notas</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{movement.occurredAt.toLocaleString()}</td><td>{bucketLabels[movement.bucket]}</td><td><strong>{movement.quantityDelta > 0 ? `+${movement.quantityDelta}` : movement.quantityDelta}</strong></td><td>{movement.reason}</td><td><small>{movement.externalReference ?? '—'}</small></td><td>{movement.notes ?? '—'}</td></tr>)}</tbody></table></div>
        {movements.length === 0 ? <div className="empty-state empty-state--embedded"><strong>Sin movimientos registrados</strong><p>El producto no tiene eventos visibles en el ledger actual.</p></div> : null}
      </>}
    </div>
  </section>;
}
