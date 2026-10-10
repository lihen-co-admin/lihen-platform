import { SocialProviderReadiness } from '../components/SocialProviderReadiness';
import { editorialDevSyncEnabled } from '../domain/editorial-persistence-mode';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createGetProductsQuery, type ProductListItemDTO } from '@lihen/products';
import { useAuth } from '../auth/auth-context';
import { productsComposition } from '../composition/products';
import { readEditorialVideoAssets } from '../composition/editorial-video-assets';
import {
  createEditorialDraft,
  editEditorialDraft,
  programEditorial,
  readEditorialWorkspace,
  resolveProductAssociationsFromMedia,
  reviewEditorial,
  saveEditorialItemInDev,
  type EditorialDraft,
} from '../composition/editorial-workspace';
import {
  channelCapability,
  editorialChannels,
  editorialStatus,
  formatEditorialDate,
  planEditorial,
  type EditorialGoals,
  type EditorialItem,
} from '../domain/editorial-planning';
import { EditorialScheduling } from '../components/EditorialScheduling';
import { EditorialAgenda } from '../components/EditorialAgenda';
import { EditorialComposer } from '../components/EditorialComposer';
import { EditorialPlanner } from '../components/EditorialPlanner';
import { EditorialVariantComparison } from '../components/EditorialVariantComparison';
import { EditorialOperationAssessment } from '../components/EditorialOperationAssessment';
import { EditorialOperationalActions } from '../components/EditorialOperationalActions';
import '../styles/editorial.css';

const initialGoals: EditorialGoals = {
  weekly: 5,
  priorityChannel: '',
  priorityProduct: '',
  priorityCampaign: '',
};
const allowedOperatorRoles = ['OWNER', 'ADMIN'];

export function SocialContentPage() {
  const auth = useAuth();
  const cacheKey = `lihen:editorial:v1:${auth.user?.id ?? 'local'}`;
  const canOperate =
    editorialDevSyncEnabled(import.meta.env) &&
    auth.enabled &&
    auth.authorized &&
    allowedOperatorRoles.includes(auth.profile?.roleCode ?? '') &&
    productsComposition.source === 'supabase';
  const [items, setItems] = useState<EditorialItem[]>([]);
  const [products, setProducts] = useState<readonly ProductListItemDTO[]>([]);
  const [goals, setGoals] = useState(initialGoals);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [filter, setFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!busy && (error || notice)) {
      feedbackRef.current?.focus();
      feedbackRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [busy, error, notice]);

  const resolveProducts = (entries: readonly EditorialItem[]) =>
    resolveProductAssociationsFromMedia(
      entries,
      products,
      async (productId) => productsComposition.getProductImages.execute({ productId }),
      readEditorialVideoAssets,
    );

  const refresh = useCallback(
    async (quiet = false, publicationId?: string) => {
      if (!canOperate) {
        setItems([]);
        setProducts([]);
        setError(
          'Conecta el Control Center a Supabase DEV e inicia sesión con un perfil OWNER o ADMIN para ver la biblioteca compartida y el Product Master.',
        );
        setLoading(false);
        return;
      }
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const remoteItems = await readEditorialWorkspace(undefined, publicationId);
        const updateItems = (next: EditorialItem[]) =>
          setItems((previous) =>
            publicationId
              ? [...previous.filter((item) => item.publication.id !== publicationId), ...next]
              : next,
          );
        updateItems(remoteItems);
        setNotice('Biblioteca editorial leída desde DEV.');
        try {
          const catalog = await productsComposition.getProducts.execute(createGetProductsQuery());
          setProducts(catalog.filter((product) => product.status === 'ACTIVE'));
          if (productsComposition.canReadImages) {
            const linked = await resolveProductAssociationsFromMedia(
              remoteItems,
              catalog,
              async (productId) => productsComposition.getProductImages.execute({ productId }),
              readEditorialVideoAssets,
            );
            updateItems(linked);
          }
        } catch (cause) {
          setProducts([]);
          setNotice(
            cause instanceof Error
              ? `Biblioteca leída desde DEV. Product Master/media no está disponible: ${cause.message}`
              : 'Biblioteca leída desde DEV; catálogo no disponible.',
          );
        }
      } catch (cause) {
        setItems([]);
        setProducts([]);
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo leer el contenido compartido desde DEV.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canOperate],
  );

  useEffect(() => {
    let active = true;
    const savedGoals = localStorage.getItem(`${cacheKey}:goals`);
    if (savedGoals) {
      try {
        setGoals({ ...initialGoals, ...(JSON.parse(savedGoals) as Partial<EditorialGoals>) });
      } catch {
        /* Invalid personal preference: keep defaults. */
      }
    }
    const load = async () => {
      await refresh();
      if (!active) return;
    };
    void load();
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [cacheKey, refresh]);

  async function perform(action: () => Promise<void>) {
    if (!canOperate || busy) {
      setError('Persistencia editorial bloqueada o acción en curso.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La operación no fue confirmada por DEV.');
    } finally {
      setBusy(false);
    }
  }

  async function save(draft: EditorialDraft) {
    await perform(async () => {
      const created = createEditorialDraft(draft, new Date(), () => crypto.randomUUID());
      const next = created.map((fresh) => {
        if (!editing || editing === 'new') return fresh;
        const previous = items.find((item) => item.publication.id === editing);
        if (!previous || previous.publication.status !== 'PREPARED')
          throw new Error('Solo se pueden editar borradores.');
        return editEditorialDraft(previous, fresh);
      });
      const confirmed: EditorialItem[] = [];
      for (const item of next)
        confirmed.push(await saveEditorialItemInDev(item, undefined, resolveProducts));
      const byId = new Map(confirmed.map((item) => [item.publication.id, item]));
      setItems((currentItems) => [
        ...currentItems.filter((item) => !byId.has(item.publication.id)),
        ...confirmed,
      ]);
      setSelected(confirmed[0]!.publication.id);
      setEditing(null);
      setNotice(
        'Guardado en DEV. El servidor confirmó los registros editoriales; no se creó un intento ni se publicó.',
      );
    });
  }

  const plan = useMemo(() => planEditorial(items, goals, now), [items, goals, now]);
  const current = items.find((item) => item.publication.id === selected);
  function open(id: string) {
    if (busy) return;
    setSelected(id);
    window.setTimeout(
      () =>
        document
          .getElementById('editorial-detail')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }
  async function transition(decision: 'SUBMIT_FOR_REVIEW' | 'APPROVE' | 'CANCEL') {
    if (!current) return;
    await perform(async () => {
      const next = await reviewEditorial(current, decision, new Date());
      const confirmed = await saveEditorialItemInDev(next, undefined, resolveProducts);
      setItems((previous) =>
        previous.map((item) => (item.publication.id === current.publication.id ? confirmed : item)),
      );
      setNotice(
        decision === 'APPROVE'
          ? 'Contenido APPROVED confirmado en DEV. Siguiente paso: elige fecha y hora y confirma la programación editorial.'
          : 'Estado de revisión guardado en DEV.',
      );
    });
  }

  return (
    <div className="stack editorial-workspace">
      <SocialProviderReadiness
        allowed={Boolean(
          import.meta.env.DEV &&
          auth.enabled &&
          auth.authorized &&
          ['OWNER', 'ADMIN'].includes(auth.profile?.roleCode ?? ''),
        )}
      />
      <section className="page-hero">
        <div>
          <p className="eyebrow">LIHEN.CO | Beauty Care • Style</p>
          <h1>Contenido y calendario</h1>
          <p role="status">
            Persistencia:{' '}
            {editorialDevSyncEnabled(import.meta.env)
              ? 'Supabase DEV · lectura durable después de guardar'
              : 'BLOQUEADA · VITE_EDITORIAL_DEV_SYNC_ENABLED deshabilitado'}
          </p>
          <p>Organiza tus ideas, prepara cada canal y decide qué sigue.</p>
        </div>
        <div className="toolbar">
          <button
            type="button"
            className="button-ghost"
            disabled={!canOperate || loading || refreshing || busy}
            onClick={() => void refresh(true)}
          >
            {refreshing ? 'Actualizando…' : 'Actualizar desde DEV'}
          </button>
          <button
            type="button"
            disabled={!canOperate || loading || busy}
            onClick={() => setEditing('new')}
          >
            + Crear contenido
          </button>
        </div>
      </section>
      <div className="info-state">
        <strong>
          {canOperate
            ? 'Biblioteca compartida · persistencia DEV'
            : 'Conexión autenticada a DEV requerida'}
        </strong>
        <p>
          Contenido, calendario y estados se leen del runtime editorial existente. Producto, campaña
          y actividad no incluidos en el contrato remoto se muestran solo cuando pueden derivarse de
          media o del historial de intentos.
        </p>
        <p>
          1. Prepara contenido por canal → 2. Envía a revisión y aprueba → 3. Elige fecha y hora →
          4. Confirma la programación.
        </p>
        <p>
          Guardar, aprobar o programar no publica contenido ni crea intentos. La ejecución externa
          automática continúa desactivada.
        </p>
      </div>
      {loading && (
        <div role="status" className="info-state">
          Cargando productos y contenido compartido de DEV…
        </div>
      )}
      {busy && (
        <div role="status" className="info-state">
          Operación en curso en DEV. Espera su resultado antes de decidir otra acción.
        </div>
      )}
      <div ref={feedbackRef} tabIndex={-1}>
        {error && (
          <div role="alert" className="error-state">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="info-state">
            {notice}
          </div>
        )}
      </div>
      <section className="editorial-today card stack">
        <div>
          <p className="eyebrow">DATOS OBSERVADOS · {plan.today}</p>
          <h2>HOY EN LIHEN</h2>
          <p>Agenda y pendientes calculados desde los registros recibidos del runtime.</p>
        </div>
        <div className="editorial-metrics">
          {[
            ['Previstos hoy', plan.todayItems.length],
            ['Pendientes de revisión', plan.review.length],
            ['Programados · 7 días', plan.scheduled.length],
            ['Días libres · 7 días', plan.gaps.length],
          ].map(([label, count]) => (
            <div key={label}>
              <strong>{count}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        {plan.todayItems.length ? (
          <div className="toolbar">
            {plan.todayItems.map((item) => (
              <button
                type="button"
                className="button-ghost"
                key={item.publication.id}
                onClick={() => open(item.publication.id)}
              >
                {channelCapability(item.publication.channel).label} · {editorialStatus(item)}
              </button>
            ))}
          </div>
        ) : (
          <p>
            {loading
              ? 'Leyendo agenda…'
              : error
                ? 'La agenda estará disponible cuando la lectura de DEV esté habilitada.'
                : 'No hay contenido previsto para hoy.'}
          </p>
        )}
        {!!plan.overdue.length && (
          <p role="status">
            Seguimiento: {plan.overdue.length} contenido(s) con fecha vencida sin intento de
            publicación exitoso.
          </p>
        )}
        <div className="toolbar">
          <Link to="/conversations">Conversaciones y pendientes</Link>
          <Link to="/products">Productos</Link>
          <Link to="/inventory">Inventario</Link>
          <Link to="/orders">Pedidos y clientes</Link>
        </div>
      </section>
      <section className="editorial-channel-grid" aria-label="Capacidades de canales">
        {editorialChannels.map((channel) => (
          <article className="card" key={channel.id}>
            <h3>{channel.label}</h3>
            <span className="editorial-chip">{channelCapability(channel.id).status}</span>
            <p>
              {channel.runtime
                ? 'Operación gobernada con media durable: Reel y TikTok requieren video. Requiere evaluación del servidor y confirmación explícita; permanece bloqueada sin configuración y habilitación.'
                : 'Preparación editorial disponible; la publicación requiere una integración gobernada.'}
            </p>
          </article>
        ))}
        <article className="card">
          <h3>WhatsApp</h3>
          <span className="editorial-chip">ENVÍO BLOQUEADO</span>
          <p>Preparación en Conversation. Coexistencia oficial todavía no confirmada.</p>
          <Link to="/conversations">Abrir Conversation</Link>
        </article>
      </section>
      {editing && (
        <EditorialComposer
          key={editing}
          item={items.find((item) => item.publication.id === editing) ?? null}
          products={products}
          busy={busy}
          onSave={(draft) => void save(draft)}
          onClose={() => setEditing(null)}
        />
      )}
      <EditorialAgenda items={items} days={plan.days} onOpen={open} />
      <section className="card stack">
        <h2>Biblioteca y próximos contenidos</h2>
        <div className="editorial-fields">
          <label>
            Filtrar estado
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">Todos</option>
              {[
                'Borrador',
                'Pendiente de revisión',
                'Aprobado · sin programar',
                'Programado editorialmente',
                'Publicado',
                'Fallido',
                'Cancelado',
              ].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Filtrar canal
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
            >
              <option value="">Todos los canales</option>
              {editorialChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="editorial-library">
          {items
            .filter(
              (item) =>
                (!filter || editorialStatus(item) === filter) &&
                (!channelFilter || item.publication.channel === channelFilter),
            )
            .sort(
              (a, b) =>
                (a.schedule?.scheduledFor.getTime() ?? Infinity) -
                (b.schedule?.scheduledFor.getTime() ?? Infinity),
            )
            .map((item) => (
              <button
                className="editorial-event"
                type="button"
                key={item.publication.id}
                onClick={() => open(item.publication.id)}
              >
                <strong>
                  {channelCapability(item.publication.channel).label} · {editorialStatus(item)}
                </strong>
                <span>{item.publication.copy}</span>
                <small>
                  {item.schedule
                    ? formatEditorialDate(item.schedule.scheduledFor) + ' · America/Bogota'
                    : 'Sin fecha'}
                </small>
                <small>
                  {products.find((product) => product.id === item.productId)?.name ??
                    (item.productId ? 'Producto asociado' : 'Sin producto durable asociado')}
                </small>
              </button>
            ))}
        </div>
        {!loading && !error && !items.length && (
          <p>No hay publicaciones editoriales durables visibles en DEV.</p>
        )}
      </section>
      {current && (
        <section className="card stack" id="editorial-detail">
          <h2>
            {channelCapability(current.publication.channel).label} · {editorialStatus(current)}
          </h2>
          <p className="editorial-copy">{current.publication.copy}</p>
          <p>{current.publication.callToAction}</p>
          <p>{current.publication.hashtags.map((tag) => `#${tag}`).join(' ')}</p>
          <p>Media: {current.publication.creativeAssetIds.length} referencia(s) durables.</p>
          <EditorialVariantComparison items={items} current={current} onOpen={open} />
          {current.productId && (
            <Link to={`/products/${current.productId}`}>Ver producto asociado</Link>
          )}
          <div className="toolbar">
            {current.publication.status === 'PREPARED' && (
              <>
                <button disabled={busy} onClick={() => setEditing(current.publication.id)}>
                  Editar borrador
                </button>
                <button disabled={busy} onClick={() => void transition('SUBMIT_FOR_REVIEW')}>
                  Enviar a revisión
                </button>
              </>
            )}
            {current.publication.status === 'IN_REVIEW' && (
              <button disabled={busy} onClick={() => void transition('APPROVE')}>
                Aprobar contenido
              </button>
            )}
            {['PREPARED', 'IN_REVIEW'].includes(current.publication.status) && (
              <button
                className="button-ghost"
                disabled={busy}
                onClick={() => void transition('CANCEL')}
              >
                Cancelar contenido
              </button>
            )}
          </div>
          <EditorialScheduling
            key={
              current.publication.id +
              ':' +
              current.publication.status +
              ':' +
              (current.schedule?.status ?? '')
            }
            item={current}
            productName={products.find((product) => product.id === current.productId)?.name}
            now={now}
            disabled={!canOperate || busy || loading || refreshing}
            onSchedule={(date) =>
              void perform(async () => {
                const next = await programEditorial(current, date, new Date(), () =>
                  crypto.randomUUID(),
                );
                const confirmed = await saveEditorialItemInDev(next, undefined, resolveProducts);
                setItems((all) =>
                  all.map((item) =>
                    item.publication.id === current.publication.id ? confirmed : item,
                  ),
                );
                setNotice(
                  'Programado editorialmente · APPROVED confirmado en DEV. La ejecución externa automática continúa desactivada; no se creó ningún intento ni se publicó.',
                );
              })
            }
          />
          <details>
            <summary>Operaciones de publicación · separadas de la programación</summary>
            <p>
              Estos controles gestionan intentos y publicación externa. No son necesarios para
              guardar la programación editorial.
            </p>
            <EditorialOperationAssessment item={current} now={now} />
            <EditorialOperationalActions
              key={current.publication.id}
              item={current}
              disabled={!canOperate || busy || loading || refreshing}
              onRefresh={() => refresh(true, current.publication.id)}
              onBusyChange={setBusy}
            />
          </details>
          <details>
            <summary>Intentos registrados por el runtime</summary>
            {current.attempts.length ? (
              <ol>
                {current.attempts.map((attempt) => (
                  <li key={attempt.id}>
                    {attempt.status} ·{' '}
                    {attempt.completedAt?.toLocaleString('es-CO') ?? 'sin completar'}
                    {attempt.failureCode ? ` · ${attempt.failureCode}` : ''}
                    {attempt.externalPublicationRef
                      ? ` · Referencia reportada: ${attempt.externalPublicationRef}`
                      : ''}
                  </li>
                ))}
              </ol>
            ) : (
              <p>Sin intentos de publicación registrados. Guardar el contenido no crea intentos.</p>
            )}
          </details>
        </section>
      )}
      <EditorialPlanner
        items={items}
        goals={goals}
        now={now}
        products={products}
        onChange={(next) => {
          localStorage.setItem(`${cacheKey}:goals`, JSON.stringify(next));
          setGoals(next);
        }}
      />
    </div>
  );
}
