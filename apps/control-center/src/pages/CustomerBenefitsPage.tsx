import { useRef, useState } from 'react';
import type { Customer } from '@lihen/customer';
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

  const [devPreviewLine, setDevPreviewLine] =
    useState<'BEAUTY_CARE' | 'STYLE'>('BEAUTY_CARE');

  const devPreviewBenefit: CustomerBenefit = {
    id: '00000000-0000-4000-8000-000000000001',
    customer_id: '00000000-0000-4000-8000-000000000002',
    benefit_code:
      devPreviewLine === 'BEAUTY_CARE'
        ? 'LIHENBC-DEV-PREVIEW'
        : 'LIHENST-DEV-PREVIEW',
    business_line: devPreviewLine,
    benefit_type: 'WELCOME',
    status: 'ACTIVE',
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
          <label className="form-field--wide">
            <span>Customer ID (vacío: todos)</span>
            <input
              value={customer}
              disabled={busy}
              onChange={(event) =>
                setCustomer(event.target.value)
              }
            />
          </label>

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

            {import.meta.env.DEV ? (
              <section className="card stack benefit-dev-preview">
                <div>
                  <span className="eyebrow">DEV · PREVIEW SEGURO</span>
                  <h3>Probar experiencia Creative sin persistencia</h3>
                  <p>
                    Este preview es sintético, vive solo en el navegador local
                    y no crea Customer Benefits ni ejecuta RPCs.
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

      <section className="card stack">
        <div>
          <span className="eyebrow">LIFECYCLE CONTROLADO</span>
          <h2>Acción controlada</h2>
          <p>
            Bono seleccionado:{' '}
            <strong>
              {benefit?.benefit_code ?? 'Ninguno'}
            </strong>
          </p>
        </div>

        <fieldset
          className="stack"
          disabled={busy || !allowed}
        >
          <label>
            <span>Acción</span>
            <select
              value={action}
              onChange={(event) =>
                setAction(
                  event.target.value as BenefitAction,
                )
              }
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
            <label>
              <span>Venta durable ID</span>
              <input
                value={sale}
                onChange={(event) =>
                  setSale(event.target.value)
                }
              />
            </label>
          ) : null}

          {(action === 'APPLY' || action === 'REMOVE') ? (
            <label>
              <span>Pedido durable ID</span>
              <input
                value={order}
                onChange={(event) =>
                  setOrder(event.target.value)
                }
              />
            </label>
          ) : null}

          {issuance ? (
            <>
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

              <p>
                El cliente se obtiene de la venta de origen;
                no se sustituye con texto libre.
              </p>
            </>
          ) : null}

          <button
            disabled={
              !benefitActionAllowed(action, benefit)
            }
            onClick={() => void execute()}
          >
            {labels[action]}
          </button>
        </fieldset>
      </section>

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
