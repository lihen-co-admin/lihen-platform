import { assessEditorialOperation } from '../domain/editorial-operation-assessment';
import type { EditorialItem } from '../domain/editorial-planning';

export function EditorialOperationAssessment({
  item,
  now,
}: {
  readonly item: EditorialItem;
  readonly now: Date;
}) {
  const assessment = assessEditorialOperation(item, now);
  return (
    <section className="stack" aria-label="Diagnóstico operativo de la variante">
      <h3>Siguiente paso operativo</h3>
      <p>
        {assessment.observedRequirementsMet
          ? 'Requisitos editoriales observables cumplidos. Ejecución bloqueada en este workspace.'
          : 'Hay requisitos pendientes o intentos que requieren revisión. Ejecución bloqueada.'}
      </p>
      <ul>
        {assessment.checks.map((check) => (
          <li key={check.code}>
            <strong>{check.observed ? 'Observado' : 'Revisar'}:</strong> {check.message}
          </li>
        ))}
      </ul>
      {assessment.followUp.length > 0 && (
        <ul>
          {assessment.followUp.map((attempt) => (
            <li key={attempt.id}>
              <code>{attempt.id}</code> · {attempt.status}: {attempt.message}
            </li>
          ))}
        </ul>
      )}
      <p>
        Diagnóstico local sobre la biblioteca leída. Actualiza desde DEV antes de decidir. La
        autorización de media, configuración del proveedor y estado actual del servidor no están
        verificados. Una recomendación no ejecuta ni aprueba; contenido generado no es oficial.
      </p>
      <details>
        <summary>Identificadores para seguimiento</summary>
        <dl>
          <dt>Publicación preparada</dt>
          <dd>{item.publication.id}</dd>
          <dt>Campaña</dt>
          <dd>{item.publication.campaignId || 'No disponible'}</dd>
          <dt>Contenido</dt>
          <dd>{item.publication.campaignContentId || 'No disponible'}</dd>
          <dt>Variante</dt>
          <dd>{item.publication.channelVariantId || 'No disponible'}</dd>
          <dt>Programación referenciada</dt>
          <dd>{item.publication.scheduleId || 'Sin programación'}</dd>
          <dt>Primera media referenciada</dt>
          <dd>{item.publication.creativeAssetIds[0] || 'Sin media'}</dd>
        </dl>
      </details>
    </section>
  );
}
