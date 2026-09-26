import { useState } from 'react';
import type {
  ContentSchedule,
  PreparedPublication,
  PublicationAttempt,
} from '@lihen/marketing';
import {
  runSocialPublicationE2E,
} from '../composition/social-publication-e2e';
import {
  isSimulationAttempt,
  summarizeSocialPublicationConsole,
} from '../domain/social-publication-console';

function createSchedule(): ContentSchedule {
  const now = new Date();

  return {
    id: `schedule-${now.getTime()}`,
    channelVariantId: 'social-local-preview',
    scheduledFor: new Date(now.getTime() - 60_000),
    timezone: 'America/Bogota',
    status: 'APPROVED',
    createdAt: now,
    updatedAt: now,
  };
}

function createPublication(
  schedule: ContentSchedule,
): PreparedPublication {
  return {
    id: `publication-${Date.now()}`,
    campaignId: 'social-11-local-campaign',
    campaignContentId: 'social-11-local-content',
    channelVariantId: schedule.channelVariantId,
    scheduleId: schedule.id,
    channel: 'INSTAGRAM_FEED',
    copy:
      'Vista previa local LIHEN.CO. ' +
      'Este contenido no se publica en una red social real.',
    callToAction: 'Revisar propuesta',
    hashtags: ['LIHENCO', 'BeautyCare', 'Style'],
    creativeAssetIds: [],
    status: 'APPROVED',
    preparedAt: new Date(),
  };
}

export function SocialContentPage() {
  const [schedule, setSchedule] =
    useState<ContentSchedule | null>(null);
  const [publication, setPublication] =
    useState<PreparedPublication | null>(null);
  const [attempt, setAttempt] =
    useState<PublicationAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = summarizeSocialPublicationConsole({
    schedules: schedule ? [schedule] : [],
    publications: publication ? [publication] : [],
    attempts: attempt ? [attempt] : [],
  });

  async function runSimulation() {
    setBusy(true);
    setError(null);

    try {
      const nextSchedule = createSchedule();
      const nextPublication =
        createPublication(nextSchedule);

      const result = await runSocialPublicationE2E({
        schedule: nextSchedule,
        publication: nextPublication,
        now: new Date(),
        attemptId: `attempt-${Date.now()}`,
      });

      setSchedule(result.schedule);
      setPublication(result.publication);
      setAttempt(result.attempt);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible ejecutar la simulación.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Marketing · Social</p>
          <h1>Centro de publicación social</h1>
          <p>
            Revisión y prueba del flujo gobernado de contenido.
            La ejecución disponible en SOCIAL-11 es local y
            no publica en Instagram, Facebook, TikTok ni WhatsApp.
          </p>
        </div>
      </section>

      <section className="info-state stack">
        <strong>PUBLICACIÓN EXTERNA BLOQUEADA</strong>
        <p>
          Esta superficie usa exclusivamente el publisher
          in-memory. Un resultado SUCCEEDED significa que el
          recorrido técnico local terminó correctamente; no
          significa que el contenido haya sido publicado.
        </p>
      </section>

      <section className="metric-grid metric-grid--premium">
        <article className="card">
          <span>Schedules aprobados</span>
          <strong>{summary.approvedSchedules}</strong>
        </article>
        <article className="card">
          <span>Publicaciones aprobadas</span>
          <strong>{summary.approvedPublications}</strong>
        </article>
        <article className="card">
          <span>Intentos completados</span>
          <strong>{summary.succeededAttempts}</strong>
        </article>
        <article className="card">
          <span>Intentos fallidos</span>
          <strong>{summary.failedAttempts}</strong>
        </article>
      </section>

      <section className="card stack">
        <h2>Prueba E2E local</h2>
        <p>
          Recorre schedule aprobado → publicación preparada
          aprobada → intento PENDING → IN_PROGRESS → SUCCEEDED
          usando únicamente memoria local.
        </p>

        <div className="toolbar">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSimulation()}
          >
            {busy
              ? 'Ejecutando simulación…'
              : 'Ejecutar prueba local'}
          </button>
        </div>

        {error ? (
          <div className="error-state">{error}</div>
        ) : null}

        {attempt ? (
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <th>Canal</th>
                  <td>{publication?.channel ?? '—'}</td>
                </tr>
                <tr>
                  <th>Schedule</th>
                  <td>{schedule?.status ?? '—'}</td>
                </tr>
                <tr>
                  <th>Publicación preparada</th>
                  <td>{publication?.status ?? '—'}</td>
                </tr>
                <tr>
                  <th>Intento</th>
                  <td>{attempt.status}</td>
                </tr>
                <tr>
                  <th>Referencia</th>
                  <td>
                    {attempt.externalPublicationRef ?? '—'}
                  </td>
                </tr>
                <tr>
                  <th>Tipo de ejecución</th>
                  <td>
                    {isSimulationAttempt(attempt)
                      ? 'SIMULACIÓN LOCAL'
                      : 'NO VERIFICADO'}
                  </td>
                </tr>
                <tr>
                  <th>Publicación externa</th>
                  <td>NO</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            Todavía no se ha ejecutado una simulación en esta sesión.
          </p>
        )}
      </section>
    </div>
  );
}
