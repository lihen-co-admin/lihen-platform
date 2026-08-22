import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { INVENTORY_ADJUSTMENT_REASONS, type InventoryAdjustmentReason, type InventoryBalance } from '@lihen/inventory';
import { PageHeader } from '../components/PageHeader';
import { inventoryComposition } from '../composition/inventory';
import { productsComposition } from '../composition/products';

const reasonLabels: Record<InventoryAdjustmentReason, string> = {
  PHYSICAL_COUNT_INCREASE: 'Conteo físico: aumento', PHYSICAL_COUNT_DECREASE: 'Conteo físico: disminución',
  DAMAGE_WRITE_OFF: 'Baja por daño', LOSS_WRITE_OFF: 'Baja por pérdida', RETURN_TO_STOCK: 'Retorno a inventario',
  MANUAL_CORRECTION: 'Corrección manual documentada',
};

export function InventoryPage() {
  const [balances, setBalances] = useState<readonly InventoryBalance[]>([]);
  const [products, setProducts] = useState<readonly { id: string; name: string; sku: string | null }[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<InventoryAdjustmentReason>('PHYSICAL_COUNT_INCREASE');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [nextBalances, nextProducts] = await Promise.all([
      inventoryComposition.getInventory.execute(), productsComposition.repository.findAll(),
    ]);
    setBalances(nextBalances);
    setProducts(nextProducts.map((p) => ({ id: p.id, name: p.name, sku: p.sku ?? null })));
  }

  useEffect(() => { refresh().catch((e) => setError(e instanceof Error ? e.message : 'No fue posible cargar inventario.')).finally(() => setLoading(false)); }, []);

  const rows = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const q = query.trim().toLowerCase();
    return balances.map((b) => ({ ...b, product: byId.get(b.productId) })).filter((row) => !q || row.product?.name.toLowerCase().includes(q) || row.product?.sku?.toLowerCase().includes(q)).slice(0, 100);
  }, [balances, products, query]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    const delta = Number(quantity);
    if (!selectedId || !Number.isInteger(delta) || delta === 0) { setError('Selecciona producto y usa una cantidad entera distinta de cero.'); return; }
    try {
      await inventoryComposition.recordAdjustment.execute({
        operationKey: `inventory-adjustment:${crypto.randomUUID()}`,
        movementId: inventoryComposition.ids.generate(), productId: selectedId, quantityDelta: delta,
        reason, occurredAt: new Date(), notes: notes.trim() || null,
      });
      setQuantity(''); setNotes(''); setMessage('Ajuste registrado en el ledger inmutable.'); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible registrar el ajuste.'); }
  }

  return <section className="stack">
    <PageHeader title="Inventario" description="FASE 2.4A · existencia física derivada de un ledger inmutable. Las reservas y pendientes se administrarán desde Pedidos y Compras." />
    <div className="info-state"><strong>Regla de seguridad</strong><p>Esta pantalla solo ajusta ON_HAND. No modifica Product Master, precio, publicación, RESERVED ni PENDING_IN.</p></div>
    {inventoryComposition.canAdjustOnHand ? <form className="card stack" onSubmit={submit}>
      <h2>Ajuste físico controlado</h2>
      <div className="form-grid">
        <label><span>Producto</span><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} required><option value="">Seleccionar…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku ? `${p.sku} · ` : ''}{p.name}</option>)}</select></label>
        <label><span>Cantidad (+ / -)</span><input type="number" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></label>
        <label><span>Motivo</span><select value={reason} onChange={(e) => setReason(e.target.value as InventoryAdjustmentReason)}>{INVENTORY_ADJUSTMENT_REASONS.map((r) => <option key={r} value={r}>{reasonLabels[r]}</option>)}</select></label>
        <label><span>Nota / evidencia operativa</span><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional, pero recomendada" /></label>
      </div>
      <button type="submit">Registrar ajuste</button>
    </form> : <div className="warning-state"><strong>Escritura bloqueada.</strong><p>Activa únicamente el modo controlado en DEV.</p></div>}
    {message ? <div className="info-state" role="status">{message}</div> : null}{error ? <div className="error-state" role="alert">{error}</div> : null}
    <div className="card stack"><div className="toolbar"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o SKU" /></div>
      {loading ? <p>Cargando…</p> : <div className="table-wrap"><table><thead><tr><th>Producto</th><th>ON_HAND</th><th>Reservado</th><th>Pendiente</th><th>Disponible</th></tr></thead><tbody>{rows.map((r) => <tr key={r.productId}><td><strong>{r.product?.name ?? r.productId}</strong><br/><small>{r.product?.sku ?? 'Sin SKU'}</small></td><td>{r.stockOnHand}</td><td>{r.stockReserved}</td><td>{r.stockPending}</td><td>{r.stockAvailable}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
