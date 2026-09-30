import {
  channelCapability,
  dayKey,
  editorialStatus,
  isEditorialScheduled,
  type EditorialItem,
} from '../domain/editorial-planning';

export function EditorialAgenda({
  items,
  days,
  onOpen,
}: {
  items: readonly EditorialItem[];
  days: readonly string[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="card stack" aria-labelledby="agenda-title">
      <div>
        <p className="eyebrow">Calendario editorial · America/Bogota</p>
        <h2 id="agenda-title">Tu semana, de un vistazo</h2>
        <p>
          Los espacios libres son oportunidades editoriales. Programar no ejecuta una publicación.
        </p>
      </div>
      <div className="editorial-week">
        {days.map((day, index) => {
          const entries = items
            .filter((item) => item.schedule && dayKey(item.schedule.scheduledFor) === day)
            .sort(
              (a, b) => a.schedule!.scheduledFor.getTime() - b.schedule!.scheduledFor.getTime(),
            );
          return (
            <article className="editorial-day" key={day}>
              <h3>
                {index === 0
                  ? 'Hoy'
                  : new Intl.DateTimeFormat('es-CO', {
                      weekday: 'long',
                      timeZone: 'America/Bogota',
                    }).format(new Date(`${day}T12:00:00-05:00`))}
              </h3>
              <small>{day}</small>
              {entries.length ? (
                entries.map((item) => (
                  <button
                    type="button"
                    className="editorial-event"
                    key={item.publication.id}
                    onClick={() => onOpen(item.publication.id)}
                  >
                    <strong>
                      {new Intl.DateTimeFormat('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Bogota',
                        hourCycle: 'h23',
                      }).format(item.schedule!.scheduledFor)}{' '}
                      · {channelCapability(item.publication.channel).label}
                    </strong>
                    <span>{item.publication.copy.slice(0, 90)}</span>
                    <small>{editorialStatus(item)}</small>
                    <small>
                      America/Bogota ·{' '}
                      {isEditorialScheduled(item)
                        ? 'Programación APPROVED'
                        : 'Fecha propuesta; no confirmada'}
                    </small>
                    {item.campaignName && <small>{item.campaignName}</small>}
                    <small>{channelCapability(item.publication.channel).status}</small>
                  </button>
                ))
              ) : (
                <p className="editorial-gap">Espacio libre</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
