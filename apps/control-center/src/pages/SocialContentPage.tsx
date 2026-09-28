import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createGetProductsQuery, type ProductListItemDTO } from '@lihen/products';
import { useAuth } from '../auth/auth-context';
import { productsComposition } from '../composition/products';
import {
  createEditorialDraft,
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
  planEditorial,
  type EditorialGoals,
  type EditorialItem,
} from '../domain/editorial-planning';
import { EditorialAgenda } from '../components/EditorialAgenda';
import { EditorialComposer } from '../components/EditorialComposer';
import { EditorialPlanner } from '../components/EditorialPlanner';
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
    import.meta.env.DEV &&
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
  const [date, setDate] = useState('');
  const [filter, setFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  const refresh = useCallback(
    async (quiet = false) => {
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
        const remoteItems = await readEditorialWorkspace();
        setItems(remoteItems);
        setNotice('Biblioteca editorial leída desde DEV.');
        try {
          const catalog = await productsComposition.getProducts.execute(createGetProductsQuery());
          setProducts(catalog.filter((product) => product.status === 'ACTIVE'));
          if (productsComposition.canReadImages) {
            const linked = await resolveProductAssociationsFromMedia(
              remoteItems,
              catalog,
              async (productId) => productsComposition.getProductImages.execute({ productId }),
            );
            setItems(linked);
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
        return {
          ...fresh,
          publication: {
            ...fresh.publication,
            id: previous.publication.id,
            campaignId: previous.publication.campaignId,
            campaignContentId: previous.publication.campaignContentId,
            channelVariantId: previous.publication.channelVariantId,
            scheduleId: fresh.schedule ? (previous.schedule?.id ?? fresh.schedule.id) : null,
          },
          schedule: fresh.schedule
            ? {
                ...fresh.schedule,
                id: previous.schedule?.id ?? fresh.schedule.id,
                channelVariantId: previous.publication.channelVariantId,
                createdAt: previous.schedule?.createdAt ?? fresh.schedule.createdAt,
              }
            : null,
          history: previous.history,
        };
      });
      for (const item of next) await saveEditorialItemInDev(item);
      const byId = new Map(next.map((item) => [item.publication.id, item]));
      setItems((currentItems) => [
        ...currentItems.filter((item) => !byId.has(item.publication.id)),
        ...next,
      ]);
      setSelected(next[0]!.publication.id);
      setEditing(null);
      setNotice(
        'Guardado en DEV. El servidor confirmó los registros editoriales; no se creó un intento ni se publicó.',
      );
    });
  }

  const plan = useMemo(() => planEditorial(items, goals, now), [items, goals, now]);
  const current = items.find((item) => item.publication.id === selected);
  function open(id: string) {
    setSelected(id);
    setDate('');
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
      await saveEditorialItemInDev(next);
      setItems((previous) =>
        previous.map((item) => (item.publication.id === current.publication.id ? next : item)),
      );
      setNotice(
        decision === 'APPROVE'
          ? 'Aprobación humana guardada en DEV.'
          : 'Estado de revisión guardado en DEV.',
      );
    });
  }

  return (
    <div className="stack editorial-workspace">
      <section className="page-hero">
        <div>
          <p className="eyebrow">LIHEN.CO | Beauty Care • Style</p>
          <h1>Contenido y calendario</h1>
          <p>Organiza tus ideas, prepara cada canal y decide qué sigue.</p>
        </div>
        <div className="toolbar">
          <button
            type="button"
            className="button-ghost"
            disabled={!canOperate || loading || refreshing}
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
        <p>Guardar, aprobar o programar no publica contenido ni crea intentos.</p>
      </div>
      {loading && (
        <div role="status" className="info-state">
          Cargando productos y contenido compartido de DEV…
        </div>
      )}
      {busy && <div role="status" className="info-state">Guardando estado editorial en DEV… No se está publicando.</div>}
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
                ? 'Preparación con imágenes de catálogo; publicación externa bloqueada en este workspace.'
                : 'Preparación editorial disponible. Reel requiere video; video y publicación TikTok no están integrados.'}
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
                    ? item.schedule.scheduledFor.toLocaleString('es-CO', {
                        timeZone: item.schedule.timezone,
                      }) +
                      ' · ' +
                      item.schedule.timezone
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
          {current.publication.status === 'APPROVED' && current.schedule?.status !== 'APPROVED' && (
            <div className="stack">
              <label>
                Programar · America/Bogota
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
              <button
                disabled={busy || !date}
                onClick={() =>
                  void perform(async () => {
                    const next = await programEditorial(current, date, new Date(), () =>
                      crypto.randomUUID(),
                    );
                    await saveEditorialItemInDev(next);
                    setItems((all) =>
                      all.map((item) =>
                        item.publication.id === current.publication.id ? next : item,
                      ),
                    );
                    setNotice('Programación editorial guardada en DEV. No se ejecutó publicación.');
                  })
                }
              >
                Confirmar programación editorial
              </button>
            </div>
          )}
          <details>
            <summary>Intentos registrados por el runtime</summary>
            {current.attempts.length ? (
              <ol>
                {current.attempts.map((attempt) => (
                  <li key={attempt.id}>
                    {attempt.status} ·{' '}
                    {attempt.completedAt?.toLocaleString('es-CO') ?? 'sin completar'}
                    {attempt.failureCode ? ` · ${attempt.failureCode}` : ''}
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
