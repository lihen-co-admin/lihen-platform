import { useRef, useState } from 'react';
import type { Customer } from '@lihen/customer';
import type { Order } from '@lihen/orders';
import type { Sale } from '@lihen/sales';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { AdminPageHero } from '../components/AdminPageHero';
import { CustomerBenefitCreative } from '../components/CustomerBenefitCreative';
import { SummaryStrip } from '../components/SummaryStrip';
import {
  benefitActions,
  benefitActionAllowed,
  canManageBenefits,
  customerBenefitsRepository,
  type BenefitAction,
  type CustomerBenefit,
} from '../composition/customer-benefits';
import { customersComposition } from '../composition/customers';
import { ordersComposition } from '../composition/orders';
import { salesComposition } from '../composition/sales';

const labels: Record<BenefitAction, string> = {
  WELCOME: 'Emitir bienvenida',
  PURCHASE_THRESHOLD: 'Emitir por umbral de compra',
  RETURN_AFTER_EXPIRED: 'Emitir retorno tras vencimiento',
  ACTIVATE: 'Activar',
  EXPIRE: 'Expirar',
  APPLY: 'Aplicar a pedido',
  REMOVE: 'Retirar de pedido',
  REDEEM: 'Redimir con venta',
};

const typeLabels: Record<CustomerBenefit['benefit_type'], string> = {
  WELCOME: 'Bono de bienvenida',
  PURCHASE_THRESHOLD: 'Bono por compra',
  RETURN_AFTER_EXPIRED: 'Bono para volver a LIHEN',
};

const statusLabels: Record<CustomerBenefit['status'], string> = {
  GENERATED: 'Preparado',
  ACTIVE: 'Activo',
  REDEEMED: 'Usado',
  EXPIRED: 'Vencido',
  CANCELLED: 'Cancelado',
};

function formatDate(value: string | null) {
  if (!value) return '—';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(parsed);
}


function formatCurrency(value: number) {
  return new Intl.NumberFormat(
    'es-CO',
    {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    },
  ).format(value);
}


function normalizeLookupText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}


export function CustomerBenefitsPage() {
  const auth = useAuth();

  const allowed =
    auth.enabled &&
    canManageBenefits(
      import.meta.env,
      auth.authorized,
      auth.profile?.roleCode,
    );

  const [rows, setRows] = useState<CustomerBenefit[]>([]);
  const [customer, setCustomer] = useState('');
  const [status, setStatus] = useState('');
  const [line, setLine] = useState('');
  const [type, setType] = useState('');
  const [validity, setValidity] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState('');
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);

  const [customerOptions, setCustomerOptions] =
    useState<Customer[]>([]);

  const [customerLookup, setCustomerLookup] =
    useState('');

  const [orderOptions, setOrderOptions] =
    useState<Order[]>([]);

  const [orderLookup, setOrderLookup] =
    useState('');

  const [saleOptions, setSaleOptions] =
    useState<Sale[]>([]);

  const [saleLookup, setSaleLookup] =
    useState('');

  const [lookupBusy, setLookupBusy] =
    useState(false);

  const [lookupError, setLookupError] =
    useState('');

  const demoPreviewEnabled =
    import.meta.env.VITE_CUSTOMER_BENEFIT_DEMO_ENABLED === 'true' &&
    window.location.hostname === 'lihen-co-admin.github.io' &&
    window.location.pathname.startsWith('/lihen-platform/control-center/');

  const [devPreviewLine, setDevPreviewLine] =
    useState<'BEAUTY_CARE' | 'STYLE'>('BEAUTY_CARE');

  const devPreviewBenefit: CustomerBenefit = {
    id: '00000000-0000-4000-8000-000000000001',
    customer_id: '00000000-0000-4000-8000-000000000002',
    benefit_code: 'DEMO-NO-CANJE',
    business_line: devPreviewLine,
    benefit_type: 'WELCOME',
    status: 'GENERATED',
    discount_percent: 15,
    created_at: '2026-10-07T12:00:00-05:00',
    issued_at: '2026-10-07T12:00:00-05:00',
    valid_from: '2026-10-07T12:00:00-05:00',
    valid_until: '2026-10-31T23:59:59-05:00',
    source_order_id: null,
    source_sale_id: null,
    redeemed_order_id: null,
    redeemed_sale_id: null,
    predecessor_benefit_id: null,
  };

  const devPreviewCustomer: Customer = {
    id: '00000000-0000-4000-8000-000000000002',
    customerCode: 'DEV-PREVIEW',
    fullName: 'Cliente DEV Preview',
    phone: '',
    phoneNormalized: '',
    whatsappPhone: null,
    address: null,
    city: 'Cali',
    neighborhood: null,
    email: null,
    notes: 'Preview local no persistente',
    preferredLine:
      devPreviewLine === 'BEAUTY_CARE'
        ? 'BEAUTY_CARE'
        : 'STYLE',
    status: 'ACTIVE',
    createdAt: new Date('2026-10-07T12:00:00-05:00'),
    updatedAt: new Date('2026-10-07T12:00:00-05:00'),
  };

  const [action, setAction] =
    useState<BenefitAction>('WELCOME');

  const [sale, setSale] = useState('');
  const [order, setOrder] = useState('');

  const [businessLine, setBusinessLine] =
    useState<'BEAUTY_CARE' | 'STYLE'>('BEAUTY_CARE');

  const [discount, setDiscount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const pending =
    useRef<{ fingerprint: string; key: string } | null>(null);

  const detailRef = useRef<HTMLElement | null>(null);

  const benefit =
    rows.find((row) => row.id === selected);

  const issuance =
    ['WELCOME', 'PURCHASE_THRESHOLD', 'RETURN_AFTER_EXPIRED']
      .includes(action);


  const customerLookupNeedle =
    normalizeLookupText(
      customerLookup,
    );

  const visibleCustomerOptions =
    customerOptions
      .filter((candidate) => {
        if (!customerLookupNeedle) {
          return true;
        }

        return [
          candidate.customerCode,
          candidate.fullName,
          candidate.phone,
          candidate.phoneNormalized,
          candidate.whatsappPhone,
          candidate.city,
        ].some((value) =>
          normalizeLookupText(value)
            .includes(
              customerLookupNeedle,
            ),
        );
      })
      .slice(
        0,
        50,
      );


  const saleLookupNeedle =
    normalizeLookupText(
      saleLookup,
    );

  const visibleSaleOptions =
    saleOptions
      .filter((candidate) => {
        if (!saleLookupNeedle) {
          return true;
        }

        return [
          candidate.saleNumber,
          candidate.customerName,
          candidate.channel,
          candidate.status,
          candidate.totalAmount,
        ].some((value) =>
          normalizeLookupText(value)
            .includes(
              saleLookupNeedle,
            ),
        );
      })
      .slice(
        0,
        100,
      );


  const orderLookupNeedle =
    normalizeLookupText(
      orderLookup,
    );

  const visibleOrderOptions =
    orderOptions
      .filter((candidate) => {
        if (!orderLookupNeedle) {
          return true;
        }

        return [
          candidate.orderNumber,
          candidate.customerName,
          candidate.customerPhone,
          candidate.channel,
          candidate.status,
        ].some((value) =>
          normalizeLookupText(value)
            .includes(
              orderLookupNeedle,
            ),
        );
      })
      .slice(
        0,
        100,
      );


  const selectedQueryCustomer =
    customerOptions.find(
      (candidate) =>
        candidate.id === customer,
    ) ?? null;


  const selectedSaleLookup =
    saleOptions.find(
      (candidate) =>
        candidate.id === sale,
    ) ?? null;


  const selectedOrderLookup =
    orderOptions.find(
      (candidate) =>
        candidate.id === order,
    ) ?? null;


  const actionLookupReady =
    issuance ||
    action === 'REDEEM'
      ? Boolean(
          selectedSaleLookup,
        )
      : (
          action === 'APPLY' ||
          action === 'REMOVE'
        )
        ? Boolean(
            selectedOrderLookup,
          )
        : true;


  async function loadCustomerOptions() {
    setLookupBusy(true);
    setLookupError('');

    try {
      const nextCustomers =
        await customersComposition
          .repository
          .list();

      setCustomerOptions(
        [...nextCustomers],
      );
    } catch (cause) {
      setLookupError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible cargar clientes.',
      );
    } finally {
      setLookupBusy(false);
    }
  }


  async function loadSaleOptions() {
    setLookupBusy(true);
    setLookupError('');

    try {
      const nextSales =
        await salesComposition
          .repository
          .list();

      setSaleOptions(
        [...nextSales],
      );
    } catch (cause) {
      setLookupError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible cargar ventas.',
      );
    } finally {
      setLookupBusy(false);
    }
  }


  async function loadOrderOptions() {
    setLookupBusy(true);
    setLookupError('');

    try {
      const nextOrders =
        await ordersComposition
          .repository
          .list();

      setOrderOptions(
        [...nextOrders],
      );
    } catch (cause) {
      setLookupError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible cargar pedidos.',
      );
    } finally {
      setLookupBusy(false);
    }
  }


  async function refresh(page = offset) {
    setBusy(true);
    setError('');

    try {
      const nextRows =
        await customerBenefitsRepository(allowed)
          .list(customer, page);

      setRows(nextRows);
      setOffset(page);
      setSelected('');
      setSelectedCustomer(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible leer bonos.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function selectBenefit(row: CustomerBenefit) {
    setSelected(row.id);
    setSelectedCustomer(null);
    setError('');

    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

      detailRef.current?.focus({
        preventScroll: true,
      });
    });

    try {
      const nextCustomer =
        await customersComposition.repository
          .getById(row.customer_id);

      setSelectedCustomer(nextCustomer);
    } catch {
      /*
       * Customer identity improves the operator UX but is not required
       * to render or preserve the benefit itself.
       */
      setSelectedCustomer(null);
    }
  }

  async function execute() {
    if (
      busy ||
      !allowed ||
      !actionLookupReady ||
      !benefitActionAllowed(action, benefit)
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setResult('');

    const fingerprint =
      JSON.stringify([
        action,
        selected,
        sale,
        order,
        businessLine,
        discount,
      ]);

    if (pending.current?.fingerprint !== fingerprint) {
      pending.current = {
        fingerprint,
        key: crypto.randomUUID(),
      };
    }

    try {
      const data =
        await customerBenefitsRepository(allowed)
          .execute(action, {
            operationKey: pending.current!.key,
            benefitId: selected,
            saleId: sale,
            orderId: order,
            businessLine,
            discountPercent: Number(discount),
          });

      setResult(JSON.stringify(data));

      setRows(
        await customerBenefitsRepository(allowed)
          .list(customer, offset),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible completar la acción.',
      );
    } finally {
      setBusy(false);
    }
  }

  const visible =
    rows.filter(
      (row) =>
        (!status || row.status === status) &&
        (!line || row.business_line === line) &&
        (!type || row.benefit_type === type) &&
        (
          !search ||
          [
            row.source_sale_id,
            row.source_order_id,
            row.redeemed_sale_id,
            row.redeemed_order_id,
            row.predecessor_benefit_id,
          ].some((value) =>
            value?.includes(search.trim()),
          )
        ) &&
        (
          !validity ||
          (
            validity === 'CURRENT'
              ? row.status === 'ACTIVE' &&
                Date.parse(row.valid_from ?? '') <= Date.now() &&
                Date.parse(row.valid_until ?? '') > Date.now()
              : Date.parse(row.valid_until ?? '') <= Date.now()
          )
        ),
    );

  const generatedCount =
    rows.filter((row) => row.status === 'GENERATED').length;

  const activeCount =
    rows.filter((row) => row.status === 'ACTIVE').length;

  const redeemedCount =
    rows.filter((row) => row.status === 'REDEEMED').length;

  const expiredCount =
    rows.filter((row) => row.status === 'EXPIRED').length;

  const cancelledCount =
    rows.filter((row) => row.status === 'CANCELLED').length;

  const beautyCareCount =
    rows.filter((row) => row.business_line === 'BEAUTY_CARE').length;

  const styleCount =
    rows.filter((row) => row.business_line === 'STYLE').length;

  return (
    <section className="stack customer-benefits-page">
      <AdminPageHero
        eyebrow="CUSTOMER BENEFITS"
        title="Clientes · Bonos"
        description="Gestiona beneficios de clientes, su vigencia, lifecycle y pieza visual desde un mismo lugar. La preparación creativa no activa, redime ni envía automáticamente ningún beneficio."
        accent="pink"
        status={
          allowed
            ? 'OWNER/ADMIN · operación controlada'
            : 'Lectura / operación bloqueada'
        }
        actions={
          <>
            <Link className="button-link" to="/orders">
              Pedidos y clientes
            </Link>
            <Link
              className="button-link button-link--secondary"
              to="/sales"
            >
              Ventas
            </Link>
          </>
        }
      />

      <SummaryStrip
        items={[
          { label: 'Bonos cargados', value: rows.length },
          { label: 'Preparados', value: generatedCount },
          { label: 'Activos', value: activeCount },
          { label: 'Usados', value: redeemedCount },
          {
            label: 'No utilizables',
            value: expiredCount + cancelledCount,
            detail: `${expiredCount} vencidos · ${cancelledCount} cancelados`,
          },
          {
            label: 'Beauty Care',
            value: beautyCareCount,
          },
          {
            label: 'Style',
            value: styleCount,
          },
        ]}
      />

      <div className="info-state">
        <strong>Human-in-the-loop</strong>
        <p>
          Las reglas, el calendario colombiano y la elegibilidad se
          validan en el servidor. No hay emisión, redención, expiración,
          envío de WhatsApp ni aplicación de descuentos automáticos.
        </p>
      </div>

      {!allowed ? (
        <div className="warning-state" role="status">
          <strong>BLOQUEADO</strong>
          <p>
            Requiere sesión Supabase OWNER/ADMIN activa y fuente Supabase.
          </p>
        </div>
      ) : null}

      <section className="card stack">
        <div>
          <span className="eyebrow">CONSULTA</span>
          <h2>Consultar bonos</h2>
          <p>
            Consulta hasta 100 registros por página y utiliza los filtros
            para localizar el beneficio correcto.
          </p>
        </div>

        <div className="form-grid">
          <div className="form-field--wide benefit-lookup-block">
            <div className="benefit-lookup-heading">
              <div>
                <span className="benefit-lookup-eyebrow">
                  CLIENTE
                </span>

                <strong>
                  Buscar por nombre, código o teléfono
                </strong>
              </div>

              <button
                type="button"
                className="button-link button-link--secondary"
                disabled={
                  busy ||
                  lookupBusy ||
                  !allowed
                }
                onClick={() =>
                  void loadCustomerOptions()
                }
              >
                {customerOptions.length
                  ? 'Actualizar clientes'
                  : 'Cargar clientes'}
              </button>
            </div>

            <input
              value={customerLookup}
              disabled={
                busy ||
                lookupBusy
              }
              placeholder="Ej. LIH-001, Laura, 300..."
              aria-label="Buscar cliente"
              onChange={(event) =>
                setCustomerLookup(
                  event.target.value,
                )
              }
            />

            <select
              value={customer}
              disabled={
                busy ||
                lookupBusy ||
                customerOptions.length === 0
              }
              aria-label="Seleccionar cliente para consultar bonos"
              onChange={(event) =>
                setCustomer(
                  event.target.value,
                )
              }
            >
              <option value="">
                Todos los clientes
              </option>

              {visibleCustomerOptions.map(
                (candidate) => (
                  <option
                    key={candidate.id}
                    value={candidate.id}
                  >
                    {candidate.customerCode} · {candidate.fullName}
                    {candidate.phone
                      ? ` · ${candidate.phone}`
                      : ''}
                  </option>
                ),
              )}
            </select>

            {selectedQueryCustomer ? (
              <div className="benefit-lookup-selection">
                <div>
                  <span>Cliente seleccionado</span>
                  <strong>
                    {selectedQueryCustomer.fullName}
                  </strong>
                </div>

                <dl>
                  <div>
                    <dt>Código</dt>
                    <dd>
                      {selectedQueryCustomer.customerCode}
                    </dd>
                  </div>

                  <div>
                    <dt>Teléfono</dt>
                    <dd>
                      {selectedQueryCustomer.phone || '—'}
                    </dd>
                  </div>

                  <div>
                    <dt>Ciudad</dt>
                    <dd>
                      {selectedQueryCustomer.city || '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </div>

          <label>
            <span>Estado</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
            >
              <option value="">Todos</option>
              {[
                'GENERATED',
                'ACTIVE',
                'EXPIRED',
                'REDEEMED',
                'CANCELLED',
              ].map((candidate) => (
                <option key={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Línea</span>
            <select
              value={line}
              onChange={(event) =>
                setLine(event.target.value)
              }
            >
              <option value="">Todas</option>
              <option>BEAUTY_CARE</option>
              <option>STYLE</option>
            </select>
          </label>

          <label>
            <span>Tipo</span>
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value)
              }
            >
              <option value="">Todos</option>
              {[
                'WELCOME',
                'PURCHASE_THRESHOLD',
                'RETURN_AFTER_EXPIRED',
              ].map((candidate) => (
                <option key={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Vigencia</span>
            <select
              value={validity}
              onChange={(event) =>
                setValidity(event.target.value)
              }
            >
              <option value="">Todas</option>
              <option value="CURRENT">Vigente</option>
              <option value="PAST">Fecha vencida</option>
            </select>
          </label>

          <label className="form-field--wide">
            <span>
              Venta/pedido origen, redención o predecesor
            </span>
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>
        </div>

        <button
          disabled={!allowed || busy}
          onClick={() => void refresh(0)}
        >
          Consultar / actualizar
        </button>
      </section>

      <section className="card stack">
        <div className="detail-card__heading">
          <div>
            <span className="eyebrow">BENEFICIOS</span>
            <h2>Bonos encontrados</h2>
          </div>
          <span className="status-badge">
            {visible.length} visibles
          </span>
        </div>

        {visible.length === 0 ? (
          <>
            <div className="empty-state">
              <strong>No hay bonos visibles en esta página.</strong>
              <p>
                Consulta o cambia los filtros. No se crean fixtures
                automáticamente para llenar este estado.
              </p>
            </div>

            {demoPreviewEnabled ? (
              <section className="card stack benefit-dev-preview">
                <div>
                  <span className="eyebrow">DEV · PREVIEW SEGURO</span>
                  <h3>Diseña y previsualiza tu bono</h3>
                  <p>
                    VISTA DE EJEMPLO · NO VÁLIDO PARA CANJE. Se genera en tu
                    navegador, sin crear bonos ni ejecutar RPCs.
                  </p>
                </div>

                <div className="toolbar">
                  <button
                    type="button"
                    onClick={() => setDevPreviewLine('BEAUTY_CARE')}
                    aria-pressed={devPreviewLine === 'BEAUTY_CARE'}
                  >
                    Beauty Care
                  </button>

                  <button
                    type="button"
                    onClick={() => setDevPreviewLine('STYLE')}
                    aria-pressed={devPreviewLine === 'STYLE'}
                  >
                    Style
                  </button>
                </div>

                <CustomerBenefitCreative
                  benefit={devPreviewBenefit}
                  customer={devPreviewCustomer}
                  demonstration
                />
              </section>
            ) : null}
          </>
        ) : (
          <div className="benefit-list">
            {visible.map((row) => (
              <article
                className={`benefit-list-item ${
                  selected === row.id
                    ? 'benefit-list-item--selected'
                    : ''
                }`}
                key={row.id}
              >
                <div>
                  <span className="eyebrow">
                    {row.business_line === 'BEAUTY_CARE'
                      ? 'BEAUTY CARE'
                      : 'STYLE'}
                  </span>
                  <strong>{row.benefit_code}</strong>
                  <span>
                    {typeLabels[row.benefit_type]} ·{' '}
                    {row.discount_percent}%
                  </span>
                  <small>
                    {row.valid_until
                      ? `Hasta ${formatDate(row.valid_until)}`
                      : 'Pendiente de activación'}
                  </small>
                </div>

                <div className="benefit-list-item__actions">
                  <span
                    className={`benefit-state benefit-state--${row.status.toLowerCase()}`}
                  >
                    {statusLabels[row.status]}
                  </span>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void selectBenefit(row)}
                    aria-pressed={selected === row.id}
                  >
                    Ver bono
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="toolbar">
          <button
            disabled={busy || !allowed || offset === 0}
            onClick={() =>
              void refresh(Math.max(0, offset - 100))
            }
          >
            Anterior
          </button>

          <button
            disabled={
              busy ||
              !allowed ||
              rows.length < 100
            }
            onClick={() =>
              void refresh(offset + 100)
            }
          >
            Siguiente
          </button>
        </div>
      </section>

      {benefit ? (
        <section
          ref={detailRef}
          tabIndex={-1}
          className="stack benefit-detail-target"
          aria-label="Detalle del bono seleccionado"
        >
          <section className="card stack">
            <div className="detail-card__heading">
              <div>
                <span className="eyebrow">DETALLE</span>
                <h2>{benefit.benefit_code}</h2>
              </div>

              <span
                className={`benefit-state benefit-state--${benefit.status.toLowerCase()}`}
              >
                {statusLabels[benefit.status]}
              </span>
            </div>

            <dl className="detail-grid">
              <div>
                <dt>Cliente</dt>
                <dd>
                  {selectedCustomer?.fullName ??
                    'Cliente registrado'}
                </dd>
              </div>

              <div>
                <dt>Código cliente</dt>
                <dd>
                  {selectedCustomer?.customerCode ??
                    'Disponible en Customer Master'}
                </dd>
              </div>

              <div>
                <dt>Línea</dt>
                <dd>
                  {benefit.business_line === 'BEAUTY_CARE'
                    ? 'Beauty Care'
                    : 'Style'}
                </dd>
              </div>

              <div>
                <dt>Tipo</dt>
                <dd>
                  {typeLabels[benefit.benefit_type]}
                </dd>
              </div>

              <div>
                <dt>Descuento</dt>
                <dd>{benefit.discount_percent}%</dd>
              </div>

              <div>
                <dt>Estado</dt>
                <dd>{statusLabels[benefit.status]}</dd>
              </div>

              <div>
                <dt>Inicio</dt>
                <dd>{formatDate(benefit.valid_from)}</dd>
              </div>

              <div>
                <dt>Vigencia</dt>
                <dd>{formatDate(benefit.valid_until)}</dd>
              </div>
            </dl>

            <details className="benefit-technical-details">
              <summary>Ver trazabilidad técnica</summary>

              <dl className="detail-grid">
                <div>
                  <dt>Venta origen</dt>
                  <dd>{benefit.source_sale_id ?? '—'}</dd>
                </div>

                <div>
                  <dt>Pedido origen</dt>
                  <dd>{benefit.source_order_id ?? '—'}</dd>
                </div>

                <div>
                  <dt>Venta redención</dt>
                  <dd>{benefit.redeemed_sale_id ?? '—'}</dd>
                </div>

                <div>
                  <dt>Pedido redención</dt>
                  <dd>{benefit.redeemed_order_id ?? '—'}</dd>
                </div>

                <div>
                  <dt>Predecesor</dt>
                  <dd>{benefit.predecessor_benefit_id ?? '—'}</dd>
                </div>
              </dl>
            </details>
          </section>

          <section className="stack">
            <div>
              <span className="eyebrow">CREATIVE</span>
              <h2>Vista del bono</h2>
              <p className="muted-text">
                La imagen se genera localmente en el navegador.
                Crear o compartir la pieza no cambia el lifecycle.
              </p>
            </div>

            <CustomerBenefitCreative
              benefit={benefit}
              customer={selectedCustomer}
            />
          </section>
        </section>
      ) : null}

      <section className="card stack benefit-lifecycle">
        <div className="benefit-lifecycle__header">
          <span className="eyebrow">LIFECYCLE CONTROLADO</span>
          <h2>Acción controlada</h2>
          <p className="benefit-lifecycle__intro">Selecciona una operación y verifica los datos antes de ejecutarla.</p>
          <div className="benefit-lifecycle__selection">
            <span>Bono seleccionado</span>
            <strong>{benefit?.benefit_code ?? 'Ninguno'}</strong>
          </div>
        </div>

        <fieldset
          className="stack benefit-lifecycle__form"
          disabled={busy || !allowed}
        >
          <label className="benefit-lifecycle__action">
            <span>Acción</span>
            <select
              value={action}
              onChange={(event) => {
                setAction(
                  event.target.value as BenefitAction,
                );

                setSale('');
                setOrder('');
                setSaleLookup('');
                setOrderLookup('');
                setLookupError('');
              }}
            >
              {(Object.keys(benefitActions) as BenefitAction[])
                .map((candidate) => (
                  <option
                    value={candidate}
                    key={candidate}
                  >
                    {labels[candidate]}
                  </option>
                ))}
            </select>
          </label>

          {(issuance || action === 'REDEEM') ? (
            <div className="benefit-lookup-block benefit-lookup-block--lifecycle">
              <div className="benefit-lookup-heading">
                <div>
                  <span className="benefit-lookup-eyebrow">
                    {issuance
                      ? 'VENTA DE ORIGEN'
                      : 'VENTA DE REDENCIÓN'}
                  </span>

                  <strong>
                    Selecciona la venta correcta
                  </strong>
                </div>

                <button
                  type="button"
                  className="button-link button-link--secondary"
                  disabled={lookupBusy}
                  onClick={() =>
                    void loadSaleOptions()
                  }
                >
                  {saleOptions.length
                    ? 'Actualizar ventas'
                    : 'Cargar ventas'}
                </button>
              </div>

              <input
                value={saleLookup}
                disabled={lookupBusy}
                placeholder="Buscar por número, cliente, canal o total"
                aria-label="Buscar venta"
                onChange={(event) =>
                  setSaleLookup(
                    event.target.value,
                  )
                }
              />

              <select
                value={sale}
                disabled={
                  lookupBusy ||
                  saleOptions.length === 0
                }
                aria-label={
                  issuance
                    ? 'Seleccionar venta de origen'
                    : 'Seleccionar venta de redención'
                }
                onChange={(event) =>
                  setSale(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Selecciona una venta
                </option>

                {visibleSaleOptions.map(
                  (candidate) => (
                    <option
                      key={candidate.id}
                      value={candidate.id}
                    >
                      {candidate.saleNumber}
                      {' · '}
                      {candidate.customerName ?? 'Cliente sin nombre'}
                      {' · '}
                      {formatCurrency(candidate.totalAmount)}
                      {' · '}
                      {candidate.status}
                    </option>
                  ),
                )}
              </select>

              {selectedSaleLookup ? (
                <div className="benefit-lookup-selection">
                  <div>
                    <span>Venta seleccionada</span>
                    <strong>
                      {selectedSaleLookup.saleNumber}
                    </strong>
                  </div>

                  <dl>
                    <div>
                      <dt>Cliente</dt>
                      <dd>
                        {selectedSaleLookup.customerName ?? '—'}
                      </dd>
                    </div>

                    <div>
                      <dt>Total</dt>
                      <dd>
                        {formatCurrency(
                          selectedSaleLookup.totalAmount,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Fecha</dt>
                      <dd>
                        {formatDate(
                          selectedSaleLookup
                            .occurredAt
                            .toISOString(),
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Estado</dt>
                      <dd>
                        {selectedSaleLookup.status}
                      </dd>
                    </div>

                    <div>
                      <dt>Canal</dt>
                      <dd>
                        {selectedSaleLookup.channel}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="benefit-lookup-help">
                  El UUID durable se obtiene internamente al seleccionar
                  una venta. La elegibilidad sigue validándose en el servidor.
                </p>
              )}
            </div>
          ) : null}

          {(action === 'APPLY' || action === 'REMOVE') ? (
            <div className="benefit-lookup-block benefit-lookup-block--lifecycle">
              <div className="benefit-lookup-heading">
                <div>
                  <span className="benefit-lookup-eyebrow">
                    PEDIDO
                  </span>

                  <strong>
                    Selecciona el pedido correcto
                  </strong>
                </div>

                <button
                  type="button"
                  className="button-link button-link--secondary"
                  disabled={lookupBusy}
                  onClick={() =>
                    void loadOrderOptions()
                  }
                >
                  {orderOptions.length
                    ? 'Actualizar pedidos'
                    : 'Cargar pedidos'}
                </button>
              </div>

              <input
                value={orderLookup}
                disabled={lookupBusy}
                placeholder="Buscar por número, cliente, teléfono, canal o estado"
                aria-label="Buscar pedido"
                onChange={(event) =>
                  setOrderLookup(
                    event.target.value,
                  )
                }
              />

              <select
                value={order}
                disabled={
                  lookupBusy ||
                  orderOptions.length === 0
                }
                aria-label="Seleccionar pedido"
                onChange={(event) =>
                  setOrder(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Selecciona un pedido
                </option>

                {visibleOrderOptions.map(
                  (candidate) => (
                    <option
                      key={candidate.id}
                      value={candidate.id}
                    >
                      {candidate.orderNumber}
                      {' · '}
                      {candidate.customerName ?? 'Cliente sin nombre'}
                      {' · '}
                      {candidate.status}
                      {' · '}
                      {candidate.channel}
                    </option>
                  ),
                )}
              </select>

              {selectedOrderLookup ? (
                <div className="benefit-lookup-selection">
                  <div>
                    <span>Pedido seleccionado</span>
                    <strong>
                      {selectedOrderLookup.orderNumber}
                    </strong>
                  </div>

                  <dl>
                    <div>
                      <dt>Cliente</dt>
                      <dd>
                        {selectedOrderLookup.customerName ?? '—'}
                      </dd>
                    </div>

                    <div>
                      <dt>Teléfono</dt>
                      <dd>
                        {selectedOrderLookup.customerPhone ?? '—'}
                      </dd>
                    </div>

                    <div>
                      <dt>Estado</dt>
                      <dd>
                        {selectedOrderLookup.status}
                      </dd>
                    </div>

                    <div>
                      <dt>Canal</dt>
                      <dd>
                        {selectedOrderLookup.channel}
                      </dd>
                    </div>

                    <div>
                      <dt>Creado</dt>
                      <dd>
                        {formatDate(
                          selectedOrderLookup
                            .createdAt
                            .toISOString(),
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="benefit-lookup-help">
                  El UUID durable se obtiene internamente al seleccionar
                  un pedido. La acción sigue protegida por el lifecycle
                  y la política del servidor.
                </p>
              )}
            </div>
          ) : null}

          {issuance ? (
            <>
              <div className="benefit-lifecycle__two-col">
              <label>
                <span>Línea comercial</span>
                <select
                  value={businessLine}
                  onChange={(event) =>
                    setBusinessLine(
                      event.target.value as typeof businessLine,
                    )
                  }
                >
                  <option>BEAUTY_CARE</option>
                  <option>STYLE</option>
                </select>
              </label>

              <label>
                <span>Descuento autorizado (%)</span>
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={discount}
                  onChange={(event) =>
                    setDiscount(event.target.value)
                  }
                />
              </label>
              </div>

              <p className="benefit-lifecycle__note">
                El cliente se obtiene de la venta de origen;
                no se sustituye con texto libre.
              </p>
            </>
          ) : null}

          <button
            className="benefit-lifecycle__submit"
            type="button"
            disabled={
              !actionLookupReady ||
              !benefitActionAllowed(action, benefit)
            }
            onClick={() => void execute()}
          >
            {labels[action]}
          </button>
        </fieldset>
      </section>

      {lookupError ? (
        <div
          className="warning-state"
          role="status"
        >
          <strong>
            No fue posible cargar opciones
          </strong>

          <p>
            {lookupError}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="error-state" role="alert">
          {error}
        </div>
      ) : null}

      {result ? (
        <details className="card">
          <summary>Resultado técnico del RPC</summary>
          <pre className="operation-json-preview">
            {result}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
