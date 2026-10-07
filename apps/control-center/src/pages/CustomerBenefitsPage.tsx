import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { benefitActions, benefitActionAllowed, canManageBenefits, customerBenefitsRepository, type BenefitAction, type CustomerBenefit } from '../composition/customer-benefits';

const labels: Record<BenefitAction, string> = { WELCOME: 'Emitir bienvenida', PURCHASE_THRESHOLD: 'Emitir por umbral de compra', RETURN_AFTER_EXPIRED: 'Emitir retorno tras vencimiento', ACTIVATE: 'Activar', EXPIRE: 'Expirar', APPLY: 'Aplicar a pedido', REMOVE: 'Retirar de pedido', REDEEM: 'Redimir con venta' };
export function CustomerBenefitsPage() {
  const auth = useAuth();
  const allowed = auth.enabled && canManageBenefits(import.meta.env, auth.authorized, auth.profile?.roleCode);
  const [rows, setRows] = useState<CustomerBenefit[]>([]);
  const [customer, setCustomer] = useState('');
  const [status, setStatus] = useState('');
  const [line, setLine] = useState('');
  const [type, setType] = useState('');
  const [validity, setValidity] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState('');
  const [action, setAction] = useState<BenefitAction>('WELCOME');
  const [sale, setSale] = useState('');
  const [order, setOrder] = useState('');
  const [businessLine, setBusinessLine] = useState<'BEAUTY_CARE' | 'STYLE'>('BEAUTY_CARE');
  const [discount, setDiscount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const benefit = rows.find(row => row.id === selected);
  const issuance = ['WELCOME', 'PURCHASE_THRESHOLD', 'RETURN_AFTER_EXPIRED'].includes(action);
  async function refresh(page = offset) {
    setBusy(true); setError('');
    try { setRows(await customerBenefitsRepository(allowed).list(customer, page)); setOffset(page); setSelected(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible leer bonos.'); }
    finally { setBusy(false); }
  }
  async function execute() {
    if (busy || !allowed || !benefitActionAllowed(action, benefit)) return;
    setBusy(true); setError(''); setResult('');
    const fingerprint = JSON.stringify([action, selected, sale, order, businessLine, discount]);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const data = await customerBenefitsRepository(allowed).execute(action, { operationKey: pending.current!.key, benefitId: selected, saleId: sale, orderId: order, businessLine, discountPercent: Number(discount) });
      setResult(JSON.stringify(data));
      // Preserve the operation key even after success: repeated clicks are idempotent.
      setRows(await customerBenefitsRepository(allowed).list(customer, offset));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible completar la acción.'); }
    finally { setBusy(false); }
  }
  const visible = rows.filter(row => (!status || row.status === status) && (!line || row.business_line === line) && (!type || row.benefit_type === type)
    && (!search || [row.source_sale_id, row.source_order_id, row.redeemed_sale_id, row.redeemed_order_id, row.predecessor_benefit_id].some(value => value?.includes(search.trim())))
    && (!validity || (validity === 'CURRENT' ? row.status === 'ACTIVE' && Date.parse(row.valid_from ?? '') <= Date.now() && Date.parse(row.valid_until ?? '') > Date.now() : Date.parse(row.valid_until ?? '') <= Date.now())));
  return <div className="stack">
    <h1>Clientes · Bonos</h1>
    <div className="toolbar"><Link to="/orders">Pedidos y clientes</Link><Link to="/sales">Ventas</Link></div>
    <p>OWNER/ADMIN · Acciones manuales vía RPC. Las reglas, el calendario colombiano y la elegibilidad se validan en el servidor. No hay emisión, redención, expiración ni envío automáticos.</p>
    {!allowed && <p role="status">BLOQUEADO · Requiere sesión Supabase OWNER/ADMIN activa y fuente Supabase.</p>}
    <section className="card stack"><h2>Consultar bonos</h2>
      <label>Customer ID (vacío: todos)<input value={customer} disabled={busy} onChange={e => setCustomer(e.target.value)} /></label>
      <button disabled={!allowed || busy} onClick={() => void refresh(0)}>Consultar / actualizar</button>
      <p>100 registros por página; los filtros siguientes se aplican a la página cargada.</p>
      <label>Estado<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option>{['GENERATED','ACTIVE','EXPIRED','REDEEMED','CANCELLED'].map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Línea<select value={line} onChange={e => setLine(e.target.value)}><option value="">Todas</option><option>BEAUTY_CARE</option><option>STYLE</option></select></label>
      <label>Tipo<select value={type} onChange={e => setType(e.target.value)}><option value="">Todos</option>{['WELCOME','PURCHASE_THRESHOLD','RETURN_AFTER_EXPIRED'].map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Vigencia<select value={validity} onChange={e => setValidity(e.target.value)}><option value="">Todas</option><option value="CURRENT">Vigente</option><option value="PAST">Fecha vencida</option></select></label>
      <label>Venta/pedido origen, redención o predecesor<input value={search} onChange={e => setSearch(e.target.value)} /></label>
      {visible.map(row => <article key={row.id}><button disabled={busy} onClick={() => setSelected(row.id)} aria-pressed={selected === row.id}>{row.benefit_code} · {row.status}</button><p>Cliente {row.customer_id} · {row.business_line} · {row.benefit_type} · {row.discount_percent}%</p><p>Vigencia: {row.valid_from ?? 'Sin activar'} — {row.valid_until ?? 'Sin activar'}</p><p>Origen venta/pedido: {row.source_sale_id ?? '—'} / {row.source_order_id ?? '—'}</p><p>Redención venta/pedido: {row.redeemed_sale_id ?? '—'} / {row.redeemed_order_id ?? '—'}</p><p>Predecesor: {row.predecessor_benefit_id ?? '—'}</p></article>)}
      <div className="toolbar"><button disabled={busy || !allowed || offset === 0} onClick={() => void refresh(Math.max(0, offset - 100))}>Anterior</button><button disabled={busy || !allowed || rows.length < 100} onClick={() => void refresh(offset + 100)}>Siguiente</button></div>
    </section>
    <section className="card stack"><h2>Acción controlada</h2><p>Bono seleccionado: {benefit?.benefit_code ?? 'Ninguno'}</p>
      <fieldset disabled={busy || !allowed}><label>Acción<select value={action} onChange={e => setAction(e.target.value as BenefitAction)}>{(Object.keys(benefitActions) as BenefitAction[]).map(x => <option value={x} key={x}>{labels[x]}</option>)}</select></label>
      {(issuance || action === 'REDEEM') && <label>Venta durable ID<input value={sale} onChange={e => setSale(e.target.value)} /></label>}
      {(action === 'APPLY' || action === 'REMOVE') && <label>Pedido durable ID<input value={order} onChange={e => setOrder(e.target.value)} /></label>}
      {issuance && <><label>Línea comercial<select value={businessLine} onChange={e => setBusinessLine(e.target.value as typeof businessLine)}><option>BEAUTY_CARE</option><option>STYLE</option></select></label><label>Descuento autorizado (%)<input type="number" min="0.01" max="100" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /></label><p>El cliente se obtiene de la venta de origen; no se sustituye con texto libre.</p></>}
      <button disabled={!benefitActionAllowed(action, benefit)} onClick={() => void execute()}>{labels[action]}</button></fieldset>
    </section>
    {error && <p role="alert">{error}</p>}{result && <pre role="status">Resultado RPC: {result}</pre>}
  </div>;
}
