import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buildConversationSummaryReadModel,
  type Conversation,
  type ConversationMessage,
  type SuggestedReply,
  type ConversationFollowUp,
} from '@lihen/conversation';
import { type Customer } from '@lihen/customer';
import { readConversations } from '../composition/conversations';
import { customersComposition } from '../composition/customers';
import { useAuth } from '../auth/auth-context';
import { whatsappCapability } from '../domain/editorial-planning';
import '../styles/editorial.css';

export function ConversationsPage() {
  const auth = useAuth();
  const [conversations, setConversations] = useState<readonly Conversation[]>([]);
  const [messages, setMessages] = useState<readonly ConversationMessage[]>([]);
  const [customers, setCustomers] = useState<readonly Customer[]>([]);
  const [selected, setSelected] = useState('');
  const [reply, setReply] = useState<SuggestedReply | null>(null);
  const [followUp, setFollowUp] = useState<ConversationFollowUp | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const current = conversations.find((item) => item.id === selected);
  const summary = current ? buildConversationSummaryReadModel(current, messages) : null;
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      const result = await readConversations();
      setConversations(result.conversations);
      setMessages(result.messages);
      setLoaded(true);
      setCustomers(await customersComposition.getCustomers.execute());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lectura no disponible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack conversation-workspace">
      <section className="page-hero">
        <div>
          <p className="eyebrow">LIHEN.CO · Conversation</p>
          <h1>Conversaciones / WhatsApp</h1>
          <p>Contexto del cliente y preparación de respuestas con decisión humana.</p>
        </div>
      </section>
      <section className="info-state">
        <strong>PREPARACIÓN / CONVERSATION DISPONIBLE · SEND BLOQUEADO</strong>
        <p>{whatsappCapability.reason} WHATSAPP_SENDING_ENABLED = false.</p>
        <p>
          Generar o aprobar una respuesta no la envía. El número oficial terminado en 4163 no se
          modifica.
        </p>
      </section>
      <div className="toolbar">
        <Link to="/content/social">Contenido y calendario</Link>
        <Link to="/products">Productos</Link>
        <Link to="/orders">Pedidos y clientes</Link>
      </div>
      <section className="card stack">
        <h2>Bandeja y pendientes</h2>
        <p>
          Lectura de las tablas durables existentes. Hasta 100 conversaciones y 500 mensajes
          recientes visibles para la sesión; no constituye un historial completo.
        </p>
        <button disabled={busy || !auth.enabled || !auth.authorized} onClick={() => void refresh()}>
          {busy ? 'Cargando…' : 'Consultar conversaciones disponibles'}
        </button>
        {!auth.enabled && (
          <p>
            Preview local sin conexión: no hay conversaciones reales cargadas. La preparación de
            respuesta está disponible debajo.
          </p>
        )}
        {error && (
          <div className="error-state" role="alert">
            {error}
          </div>
        )}
        {loaded && !conversations.length && (
          <p>
            Sin conversaciones visibles para esta sesión. Los permisos de lectura compartida están
            pendientes; una lista vacía no demuestra que no existan
            conversaciones.
          </p>
        )}
        {conversations.map((item) => (
          <button
            className="editorial-event"
            key={item.id}
            onClick={() => {
              setSelected(item.id);
              setReply(null);
              setFollowUp(null);
              setBody('');
            }}
          >
            <strong>
              {item.channel} · {item.status}
            </strong>
            <span>
              {customers.find((customer) => customer.id === item.customerId)?.fullName ??
                item.customerId ??
                'Cliente sin asociar'}
            </span>
            <small>
              {item.lastActivityAt.toLocaleString('es-CO')} ·{' '}
              {item.status === 'WAITING_LIHEN' ? 'Pendiente de atención' : 'Abrir conversación'}
            </small>
          </button>
        ))}
      </section>
      {current && (
        <section className="card stack">
          <h2>Contexto de la conversación</h2>
          <p>
            Cliente:{' '}
            {customers.find((customer) => customer.id === current.customerId)?.fullName ??
              current.customerId ??
              'Sin asociar'}
          </p>
          <p>Estado: {current.status} · Intención: sin clasificación persistida disponible.</p>
          {current.orderId && (
            <p>
              Pedido relacionado: {current.orderId} · <Link to="/orders">Abrir pedidos</Link>
            </p>
          )}
          <div className="toolbar">
            {current.productIds.map((id) => (
              <Link key={id} to={`/products/${id}`}>
                Producto {id}
              </Link>
            ))}
          </div>
          <p>
            {summary?.messageCount} mensajes en la lectura actual. OUTBOUND no equivale a envío
            confirmado.
          </p>
          {messages
            .filter((message) => message.conversationId === current.id)
            .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
            .map((message) => (
              <article key={message.id}>
                <strong>
                  {message.senderRole} · {message.occurredAt.toLocaleString('es-CO')}
                </strong>
                <p className="editorial-copy">{message.body}</p>
              </article>
            ))}
        </section>
      )}
      <section className="card stack">
        <h2>Preparar respuesta para revisión humana</h2>
        <p>
          {current
            ? 'Preparación vinculada a la conversación seleccionada.'
            : 'Mesa de preparación sin conversación seleccionada.'}{' '}
          Solo en esta sesión: las respuestas sugeridas y los seguimientos aún no tienen persistencia
          durable. Al salir se pierde esta preparación.
        </p>
        <label>
          Respuesta sugerida
          <textarea
            rows={5}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setReply(null);
            }}
            placeholder="Escribe una respuesta para revisión; no se enviará."
          />
        </label>
        <div className="toolbar">
          <button
            disabled={!body.trim()}
            onClick={() =>
              setReply({
                conversationId: current?.id ?? 'local-preparation',
                body: body.trim(),
                status: 'READY_FOR_REVIEW',
                generatedAt: new Date(),
              })
            }
          >
            Preparar revisión
          </button>
          {reply?.status === 'READY_FOR_REVIEW' && (
            <button onClick={() => setReply({ ...reply, status: 'APPROVED' })}>
              Marcar revisada en esta sesión
            </button>
          )}
        </div>
        {reply && <p role="status">{reply.status} · Sin enviar · Sin persistencia durable</p>}
        {current && (
          <>
            <button
              onClick={() =>
                setFollowUp({
                  conversationId: current.id,
                  reason: 'Revisar la respuesta y el contexto del cliente',
                  dueAt: null,
                  status: 'OPEN',
                })
              }
            >
              Preparar seguimiento de esta conversación
            </button>
            {followUp && (
              <p>
                {followUp.reason} · {followUp.status} · Solo en esta sesión{' '}
                <button onClick={() => setFollowUp({ ...followUp, status: 'DONE' })}>
                  Marcar realizado
                </button>
              </p>
            )}
          </>
        )}
        <button disabled>Enviar WhatsApp · bloqueado</button>
      </section>
    </div>
  );
}
