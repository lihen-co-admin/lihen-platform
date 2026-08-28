import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Purchase } from '@lihen/procurement';
import type { Supplier } from '@lihen/suppliers';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { procurementComposition } from '../composition/procurement';
import { suppliersComposition } from '../composition/suppliers';
import { productsComposition } from '../composition/products';

interface DraftLine {
  readonly key: string;
  readonly productId: string;
  readonly quantity: string;
  readonly cost: string;
}

const createDraftLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  productId: '',
  quantity: '1',
  cost: '',
});

const purchaseStatusLabel: Record<Purchase['status'], string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmada',
  PARTIALLY_RECEIVED: 'Recepción parcial',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
};

export function PurchasesPage() {
  const [rows, setRows] = useState<readonly Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<readonly Supplier[]>([]);
  const [products, setProducts] = useState<readonly { id: string; name: string; sku: string | null }[]>([]);
  const [number, setNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([createDraftLine()]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    const [purchases, supplierRows, productRows] = await Promise.all([
      procurementComposition.getPurchases.execute(),
      suppliersComposition.getSuppliers.execute(),
      productsComposition.repository.findAll(),
    ]);

    setRows(purchases);
    setSuppliers(supplierRows.filter((supplier) => supplier.status === 'ACTIVE'));
    setProducts(productRows.map((product) => ({ id: product.id, name: product.name, sku: product.sku ?? null })));
  }

  useEffect(() => {
    refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar compras.'));
  }, []);

  const supplierNames = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.businessName])),
    [suppliers],
  );

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const purchase of rows) counts.set(purchase.status, (counts.get(purchase.status) ?? 0) + 1);

    return [
      { label: 'Compras', value: rows.length, detail: 'Registros canónicos' },
      { label: 'Borradores', value: counts.get('DRAFT') ?? 0, detail: 'Sin efecto en inventario' },
      { label: 'Por recibir', value: (counts.get('CONFIRMED') ?? 0) + (counts.get('PARTIALLY_RECEIVED') ?? 0), detail: 'Seguimiento operativo' },
      { label: 'Recibidas', value: counts.get('RECEIVED') ?? 0, detail: 'Recepción completada' },
    ];
  }, [rows]);

  const intelligenceInsights = useMemo<IntelligenceInsight[]>(() => {
    const confirmed = rows.filter((purchase) => purchase.status === 'CONFIRMED').length;
    const partial = rows.filter((purchase) => purchase.status === 'PARTIALLY_RECEIVED').length;
    const drafts = rows.filter((purchase) => purchase.status === 'DRAFT').length;
    const insights: IntelligenceInsight[] = [];

    if (confirmed + partial > 0) {
      insights.push({
        id: 'purchases-receipt-attention',
        severity: 'WARNING',
        title: `${confirmed + partial} compra${confirmed + partial === 1 ? '' : 's'} requiere${confirmed + partial === 1 ? '' : 'n'} seguimiento de recepción`,
        explanation: 'Las compras confirmadas o parcialmente recibidas deben avanzar por su flujo de recepción; el inventario no se corrige manualmente.',
        source: 'Compras + ledger de inventario',
      });
    }

    if (drafts > 0) {
      insights.push({
        id: 'purchases-drafts',
        severity: 'INFO',
        title: `${drafts} borrador${drafts === 1 ? '' : 'es'} pendiente${drafts === 1 ? '' : 's'} de decisión`,
        explanation: 'Un borrador conserva intención de compra, pero no cambia existencia física ni caja hasta atravesar los gates de dominio correspondientes.',
        source: 'Purchase Master',
      });
    }

    if (suppliers.length === 0) {
      insights.push({
        id: 'purchases-no-suppliers',
        severity: 'CRITICAL',
        title: 'No hay proveedores activos para nuevas compras',
        explanation: 'La creación de una compra necesita un proveedor activo. Revisa Proveedores antes de intentar registrar abastecimiento.',
        actionLabel: 'Ir a proveedores',
        targetRoute: '/suppliers',
        source: 'Supplier Master',
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: 'purchases-stable',
        severity: 'SUCCESS',
        title: 'Flujo de compras sin alertas inmediatas',
        explanation: 'No se detectan borradores ni recepciones pendientes dentro de la lectura actual.',
        source: 'Compras canónicas',
      });
    }

    return insights;
  }, [rows, suppliers.length]);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const items = lines.map((line) => ({
        id: procurementComposition.ids.generate(),
        productId: line.productId,
        quantityRequested: Number(line.quantity),
        quotedUnitCost: line.cost.trim() === '' ? null : Number(line.cost),
      }));

      await procurementComposition.createDraft.execute({
        operationKey: `purchase-draft:${crypto.randomUUID()}`,
        purchaseId: procurementComposition.ids.generate(),
        purchaseNumber: number,
        supplierId,
        purchaseDate: purchaseDate || null,
        expectedDate: expectedDate || null,
        notes: notes.trim() || null,
        items,
      });

      setNumber('');
      setSupplierId('');
      setPurchaseDate('');
      setExpectedDate('');
      setNotes('');
      setLines([createDraftLine()]);
      setMessage('Borrador de compra creado. Todavía no afecta inventario ni caja.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible crear la compra.');
    }
  }

  return (
    <section className="stack purchases-page">
      <AdminPageHero
        eyebrow="ABASTECIMIENTO"
        title="Compras"
        description="Gestiona abastecimiento a proveedores sin saltarte los pasos de confirmación, recepción y registro financiero. Cada transición conserva trazabilidad."
        accent="gold"
        status={<span className={`status-badge ${procurementComposition.canWrite ? 'status-badge--success' : 'status-badge--warning'}`}>{procurementComposition.canWrite ? 'ESCRITURA CONTROLADA' : 'SOLO LECTURA'}</span>}
      />

      <SummaryStrip items={summary} />

      <IntelligencePanel
        title="Lectura operativa de compras"
        description="Prioriza borradores y recepciones pendientes sin modificar inventario ni caja automáticamente."
        insights={intelligenceInsights}
      />

      <OperationalNotice title="Una compra avanza por etapas" tone="info" meta="Borrador → confirmación → recepción → flujo financiero">
        <p>Crear un borrador no cambia ON_HAND, PENDING_IN ni saldos financieros. La recepción debe ser la causa auditable del movimiento de inventario.</p>
      </OperationalNotice>

      {procurementComposition.canWrite ? (
        <form className="card stack admin-form-card" onSubmit={submit}>
          <div className="card-heading">
            <div>
              <span className="card-label">Nueva operación</span>
              <h2>Nueva compra en borrador</h2>
            </div>
            <span className="line-badge">DRAFT</span>
          </div>

          <div className="form-grid">
            <label>
              <span>Número / referencia</span>
              <input required value={number} onChange={(event) => setNumber(event.target.value)} />
            </label>
            <label>
              <span>Proveedor activo</span>
              <select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                <option value="">Seleccionar…</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.businessName}</option>)}
              </select>
            </label>
            <label>
              <span>Fecha compra</span>
              <input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
            </label>
            <label>
              <span>Fecha esperada</span>
              <input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
            </label>
            <label className="form-field--wide">
              <span>Notas</span>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>

          <div className="card-heading">
            <div>
              <span className="card-label">Detalle</span>
              <h3>Productos solicitados</h3>
            </div>
            <span className="line-badge">{lines.length} línea{lines.length === 1 ? '' : 's'}</span>
          </div>

          {lines.map((line, index) => (
            <div className="form-grid workflow-line" key={line.key}>
              <label>
                <span>Producto {index + 1}</span>
                <select required value={line.productId} onChange={(event) => updateLine(line.key, { productId: event.target.value })}>
                  <option value="">Seleccionar…</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.sku ? `${product.sku} · ` : ''}{product.name}</option>)}
                </select>
              </label>
              <label>
                <span>Cantidad</span>
                <input required type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} />
              </label>
              <label>
                <span>Costo cotizado unitario</span>
                <input type="number" min="0" step="0.01" value={line.cost} onChange={(event) => updateLine(line.key, { cost: event.target.value })} />
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
        <OperationalNotice title="Escritura de compras bloqueada" tone="warning">
          <p>La pantalla permanece disponible para lectura. Habilitar escritura requiere la configuración controlada y permisos correspondientes.</p>
        </OperationalNotice>
      )}

      {message ? <OperationalNotice title="Operación completada" tone="success"><p>{message}</p></OperationalNotice> : null}
      {error ? <div className="error-state">{error}</div> : null}

      <section className="table-card">
        <div className="table-summary">
          <div>
            <span className="card-label">Historial operativo</span>
            <h2>Compras registradas</h2>
          </div>
          <span>{rows.length} registro{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Número</th><th>Proveedor</th><th>Estado</th><th>Compra</th><th>Esperada</th></tr>
            </thead>
            <tbody>
              {rows.map((purchase) => (
                <tr key={purchase.id}>
                  <td><Link className="text-link" to={`/purchases/${purchase.id}`}><strong>{purchase.purchaseNumber}</strong></Link></td>
                  <td>{supplierNames.get(purchase.supplierId) ?? purchase.supplierId}</td>
                  <td><span className={`workflow-status workflow-status--${purchase.status.toLowerCase()}`}>{purchaseStatusLabel[purchase.status]}</span></td>
                  <td>{purchase.purchaseDate ?? '—'}</td>
                  <td>{purchase.expectedDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <div className="empty-state empty-state--embedded"><strong>Aún no hay compras canónicas</strong><p>Cuando registres una compra aparecerá aquí con su estado operativo.</p></div> : null}
      </section>
    </section>
  );
}
