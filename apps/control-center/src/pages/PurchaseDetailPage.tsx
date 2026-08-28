import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { InventoryMovement } from '@lihen/inventory';
import {
  evaluatePurchaseSupplyReadiness,
  type Purchase,
  type PurchaseItem,
} from '@lihen/procurement';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { procurementComposition } from '../composition/procurement';
import { inventoryComposition } from '../composition/inventory';
import { productsComposition } from '../composition/products';
import { suppliersComposition } from '../composition/suppliers';
import { reconcilePurchaseWithInventory } from '../domain/supply-inventory-reconciliation';

interface ReceiptInput { quantity: string; cost: string }

const supplyStatusLabel = {
  DRAFT: 'Borrador',
  AWAITING_RECEIPT: 'Pendiente de recepción',
  PARTIAL_RECEIPT: 'Recepción parcial',
  RECEIVED: 'Recepción completa',
  CANCELLED: 'Cancelada',
} as const;

export function PurchaseDetailPage() {
  const { id } = useParams();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<readonly PurchaseItem[]>([]);
  const [productNames, setProductNames] = useState(new Map<string, string>());
  const [supplierName, setSupplierName] = useState('');
  const [supplierActive, setSupplierActive] = useState<boolean | null>(null);
  const [supplyMovements, setSupplyMovements] = useState(new Map<string, readonly InventoryMovement[]>());
  const [receipt, setReceipt] = useState<Record<string, ReceiptInput>>({});
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    if (!id) return;
    const [nextPurchase, nextItems, products, suppliers] = await Promise.all([
      procurementComposition.repository.getById(id),
      procurementComposition.repository.listItems(id),
      productsComposition.repository.findAll(),
      suppliersComposition.getSuppliers.execute(),
    ]);
    setPurchase(nextPurchase);
    setItems(nextItems);
    setProductNames(new Map(products.map((product) => [product.id, product.name])));
    const supplier = nextPurchase ? suppliers.find((candidate) => candidate.id === nextPurchase.supplierId) : undefined;
    setSupplierName(supplier?.businessName ?? 'Proveedor no encontrado');
    setSupplierActive(supplier ? supplier.status === 'ACTIVE' : false);
    const movementEntries = await Promise.all(nextItems.map(async (item) => [
      item.productId,
      await inventoryComposition.getMovements.execute(item.productId),
    ] as const));
    setSupplyMovements(new Map(movementEntries));
    setReceipt(Object.fromEntries(nextItems
      .filter((item) => item.quantityReceived < item.quantityRequested)
      .map((item) => [item.id, {
        quantity: String(item.quantityRequested - item.quantityReceived),
        cost: String(item.finalUnitCost ?? item.quotedUnitCost ?? ''),
      }])));
  }

  useEffect(() => {
    refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar la compra.'));
  }, [id]);

  const readiness = useMemo(
    () => purchase ? evaluatePurchaseSupplyReadiness(purchase, items) : null,
    [purchase, items],
  );

  const reconciliation = useMemo(
    () => purchase ? reconcilePurchaseWithInventory(purchase, items, supplyMovements) : null,
    [purchase, items, supplyMovements],
  );

  const intelligence = useMemo<readonly IntelligenceInsight[]>(() => {
    if (!purchase || !readiness) return [];
    const insights: IntelligenceInsight[] = [];

    if (supplierActive === false) {
      insights.push({
        id: 'purchase-supplier-integrity', severity: 'WARNING', title: 'Proveedor no activo o no disponible',
        explanation: 'La compra conserva su referencia histórica, pero nuevas decisiones de abastecimiento deben revisar Supplier Master antes de continuar.',
        actionLabel: 'Abrir proveedores', targetRoute: '/suppliers', source: 'Supplier Master + Purchase Master',
      });
    }
    if (reconciliation?.status === 'MISMATCH') {
      insights.push({
        id: 'purchase-inventory-mismatch', severity: 'CRITICAL', title: `${reconciliation.mismatchedLines} línea${reconciliation.mismatchedLines === 1 ? '' : 's'} no concilia${reconciliation.mismatchedLines === 1 ? '' : 'n'} con inventario`,
        explanation: 'PENDING_IN y ON_HAND no coinciden con las cantidades confirmadas/recibidas de la compra. Investiga el ledger; LIHEN Intelligence no corrige saldos automáticamente.',
        actionLabel: 'Abrir inventario', targetRoute: '/inventory', source: 'Purchase ↔ Inventory reconciliation',
      });
    } else if (reconciliation?.status === 'PASS') {
      insights.push({
        id: 'purchase-inventory-pass', severity: 'SUCCESS', title: 'Compra e inventario conciliados',
        explanation: 'Las cantidades pendientes y recibidas coinciden con los movimientos PENDING_IN y ON_HAND asociados a esta compra.',
        source: 'Purchase ↔ Inventory reconciliation',
      });
    }

    if (readiness.overdue) {
      insights.push({
        id: 'purchase-overdue', severity: 'WARNING', title: 'Recepción fuera de la fecha esperada',
        explanation: `Quedan ${readiness.remainingUnits} unidades pendientes. El seguimiento debe continuar desde Compras; no mediante ajustes manuales de stock.`,
        actionLabel: 'Abrir inventario', targetRoute: '/inventory', source: 'Purchase Supply Readiness',
      });
    }
    if (readiness.status === 'DRAFT') {
      insights.push({
        id: 'purchase-draft-readiness', severity: readiness.canConfirm ? 'INFO' : 'CRITICAL',
        title: readiness.canConfirm ? 'Borrador listo para decisión' : 'Borrador con bloqueos',
        explanation: readiness.canConfirm
          ? 'Confirmar la compra expresa compromiso de abastecimiento y prepara PENDING_IN; no significa recepción física.'
          : readiness.blockers.join(' '),
        source: 'Purchase Supply Readiness',
      });
    }
    if (readiness.status === 'PARTIAL_RECEIPT') {
      insights.push({
        id: 'purchase-partial', severity: 'INFO', title: `Recepción al ${readiness.receiptProgressPercent}%`,
        explanation: `Se han recibido ${readiness.receivedUnits} de ${readiness.requestedUnits} unidades. Solo las unidades físicamente recibidas deben pasar a ON_HAND.`,
        source: 'Purchase Supply Readiness',
      });
    }
    if (readiness.status === 'RECEIVED') {
      insights.push({
        id: 'purchase-received', severity: 'SUCCESS', title: 'Recepción física completada',
        explanation: 'El abastecimiento quedó recibido. El pago al proveedor sigue siendo un flujo financiero separado y auditable.',
        source: 'Purchase Supply Readiness',
      });
    }
    return insights;
  }, [purchase, readiness, reconciliation, supplierActive]);

  async function confirm() {
    if (!purchase || !readiness?.canConfirm) return;
    setError(''); setMessage('');
    try {
      await procurementComposition.confirm.execute({
        operationKey: `purchase-confirm:${crypto.randomUUID()}`,
        purchaseId: purchase.id,
        occurredAt: new Date(),
      });
      setMessage('Compra confirmada. Las unidades quedan pendientes de recepción física según el flujo controlado.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible confirmar la compra.');
    }
  }

  async function receive(event: FormEvent) {
    event.preventDefault();
    if (!purchase || !readiness?.canReceive) return;
    setError(''); setMessage('');
    try {
      const lines = items
        .filter((item) => item.quantityReceived < item.quantityRequested)
        .map((item) => ({
          purchaseItemId: item.id,
          quantityReceived: Number(receipt[item.id]?.quantity ?? 0),
          finalUnitCost: Number(receipt[item.id]?.cost ?? Number.NaN),
        }))
        .filter((line) => line.quantityReceived > 0);

      if (lines.length === 0) {
        setError('Registra al menos una cantidad recibida mayor que cero.');
        return;
      }

      await procurementComposition.receive.execute({
        operationKey: `purchase-receive:${crypto.randomUUID()}`,
        purchaseId: purchase.id,
        receivedAt: new Date(),
        notes: notes.trim() || null,
        lines,
      });
      setMessage('Recepción registrada. El ledger refleja únicamente las unidades físicamente recibidas.');
      setNotes('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible registrar la recepción.');
    }
  }

  if (!id) return <div className="error-state">Compra inválida.</div>;
  if (!purchase || !readiness) {
    return <section className="stack">
      <AdminPageHero title="Compra" description="Cargando detalle operativo y trazabilidad de abastecimiento." accent="gold" />
      {error ? <div className="error-state">{error}</div> : <div className="loading-card"><span className="loading-spinner" /><div><strong>Cargando compra</strong><p>Consultando líneas y estado de recepción…</p></div></div>}
    </section>;
  }

  return <section className="stack purchase-detail-page">
    <AdminPageHero
      eyebrow="ABASTECIMIENTO"
      title={`Compra ${purchase.purchaseNumber}`}
      description="Detalle de compromiso, recepción física y trazabilidad. Inventario y finanzas conservan responsabilidades separadas."
      accent="gold"
      status={<span className={`status-badge ${readiness.status === 'RECEIVED' ? 'status-badge--success' : readiness.overdue ? 'status-badge--warning' : ''}`}>{supplyStatusLabel[readiness.status]}</span>}
    />

    <SummaryStrip items={[
      { label: 'Proveedor', value: supplierName, detail: supplierActive ? 'Activo' : 'Revisar Supplier Master' },
      { label: 'Solicitado', value: readiness.requestedUnits, detail: 'Unidades' },
      { label: 'Recibido', value: readiness.receivedUnits, detail: `${readiness.receiptProgressPercent}%` },
      { label: 'Pendiente', value: readiness.remainingUnits, detail: 'Por recepción física' },
      { label: 'Conciliación', value: reconciliation?.status ?? '—', detail: reconciliation?.status === 'MISMATCH' ? 'Revisión requerida' : 'Purchase ↔ Inventory' },
    ]} />

    <div className="toolbar"><Link className="button-link button-link--secondary" to="/purchases">← Volver a compras</Link></div>

    {intelligence.length > 0 ? <IntelligencePanel title="Readiness de abastecimiento" description="Evaluación determinística de la compra; no ejecuta acciones automáticamente." insights={intelligence} /> : null}

    <OperationalNotice title="Contrato compra → inventario" meta="Confirmación ≠ recepción ≠ pago">
      La confirmación representa abastecimiento pendiente. La recepción física es la causa auditable para mover unidades hacia ON_HAND. Pagar al proveedor pertenece al ledger financiero y no ocurre desde esta pantalla.
    </OperationalNotice>

    {message ? <OperationalNotice title="Operación completada" tone="success">{message}</OperationalNotice> : null}
    {error ? <div className="error-state" role="alert">{error}</div> : null}

    <div className="card stack">
      <div className="card-heading"><div><span className="card-label">Detalle canónico</span><h2>Productos</h2></div><span className="line-badge">{items.length} línea{items.length === 1 ? '' : 's'}</span></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Producto</th><th>Solicitado</th><th>Recibido</th><th>Pendiente</th><th>Costo cotizado</th><th>Costo final</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{productNames.get(item.productId) ?? item.productId}</strong></td><td>{item.quantityRequested}</td><td>{item.quantityReceived}</td><td>{item.quantityRequested - item.quantityReceived}</td><td>{item.quotedUnitCost ?? '—'}</td><td>{item.finalUnitCost ?? '—'}</td></tr>)}</tbody></table></div>
    </div>

    {reconciliation ? <div className="card stack">
      <div className="card-heading"><div><span className="card-label">Conciliación read-only</span><h2>Compra ↔ Inventario</h2></div><span className={`status-badge ${reconciliation.status === 'PASS' ? 'status-badge--success' : reconciliation.status === 'MISMATCH' ? 'status-badge--warning' : ''}`}>{reconciliation.status}</span></div>
      <p>Se compara el pendiente esperado de cada línea con PENDING_IN y la recepción acumulada con entradas ON_HAND que usan la referencia <strong>{purchase.purchaseNumber}</strong>. Esta lectura nunca repara el ledger automáticamente.</p>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Producto</th><th>Pendiente compra</th><th>PENDING_IN ledger</th><th>Recibido compra</th><th>ON_HAND por recepción</th><th>Estado</th></tr></thead><tbody>{reconciliation.lines.map((line) => <tr key={line.purchaseItemId}><td><strong>{productNames.get(line.productId) ?? line.productId}</strong></td><td>{line.expectedPendingUnits}</td><td>{line.ledgerPendingUnits}</td><td>{line.receivedUnits}</td><td>{line.ledgerReceivedOnHandUnits}</td><td><span className={`status-badge ${line.status === 'PASS' ? 'status-badge--success' : line.status === 'MISMATCH' ? 'status-badge--warning' : ''}`}>{line.status}</span></td></tr>)}</tbody></table></div>
    </div> : null}

    {purchase.status === 'DRAFT' && procurementComposition.canWrite ? <div className="card stack admin-form-card"><div className="card-heading"><div><span className="card-label">Transición controlada</span><h2>Confirmar compra</h2></div><span className="status-badge">DRAFT → CONFIRMED</span></div><p>Confirma solo cuando proveedor, líneas y cantidades representen el compromiso real de abastecimiento.</p><div className="form-actions"><button type="button" disabled={!readiness.canConfirm} onClick={() => void confirm()}>Confirmar compra</button></div></div> : null}

    {readiness.canReceive && procurementComposition.canWrite ? <form className="card stack admin-form-card" onSubmit={receive}>
      <div className="card-heading"><div><span className="card-label">Recepción física</span><h2>Registrar llegada real</h2></div><span className="status-badge">PENDING_IN → ON_HAND</span></div>
      <p>Registra únicamente lo que llegó físicamente. No completes cantidades por expectativa ni por factura.</p>
      {items.filter((item) => item.quantityReceived < item.quantityRequested).map((item) => {
        const left = item.quantityRequested - item.quantityReceived;
        return <div className="form-grid workflow-line" key={item.id}>
          <strong>{productNames.get(item.productId) ?? item.productId}</strong>
          <label><span>Cantidad recibida (máx. {left})</span><input type="number" min="0" max={left} step="1" required value={receipt[item.id]?.quantity ?? ''} onChange={(event) => setReceipt((current) => ({ ...current, [item.id]: { ...(current[item.id] ?? { cost: '' }), quantity: event.target.value } }))} /></label>
          <label><span>Costo final unitario</span><input type="number" min="0" step="0.01" required value={receipt[item.id]?.cost ?? ''} onChange={(event) => setReceipt((current) => ({ ...current, [item.id]: { ...(current[item.id] ?? { quantity: '0' }), cost: event.target.value } }))} /></label>
        </div>;
      })}
      <label><span>Notas / evidencia de recepción</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional, recomendada ante diferencias" /></label>
      <div className="form-actions"><button type="submit">Registrar recepción</button></div>
    </form> : null}

    {!procurementComposition.canWrite && ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(purchase.status) ? <OperationalNotice title="Escritura protegida" tone="warning">La compra puede inspeccionarse, pero sus transiciones requieren modo controlado y permisos válidos en DEV.</OperationalNotice> : null}
  </section>;
}
