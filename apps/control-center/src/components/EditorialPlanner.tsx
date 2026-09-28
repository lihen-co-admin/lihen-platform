import type { ProductListItemDTO } from '@lihen/products';
import { IntelligencePanel } from './IntelligencePanel';
import {
  editorialChannels,
  planEditorial,
  type EditorialGoals,
  type EditorialItem,
} from '../domain/editorial-planning';

export function EditorialPlanner({
  items,
  goals,
  now,
  products,
  onChange,
}: {
  items: readonly EditorialItem[];
  goals: EditorialGoals;
  now: Date;
  products: readonly ProductListItemDTO[];
  onChange: (goals: EditorialGoals) => void;
}) {
  const plan = planEditorial(items, goals, now);
  return (
    <section className="stack">
      <div className="card stack">
        <h2>Objetivo vs. programado</h2>
        <p>Próximos 7 días · preferencias guardadas en este navegador.</p>
        <div className="editorial-fields">
          <label>
            Publicaciones deseadas por semana
            <input
              type="number"
              min="0"
              max="100"
              value={goals.weekly}
              onChange={(event) =>
                onChange({
                  ...goals,
                  weekly: Math.min(100, Math.max(0, Number(event.target.value))),
                })
              }
            />
          </label>
          <label>
            Canal prioritario
            <select
              value={goals.priorityChannel}
              onChange={(event) => onChange({ ...goals, priorityChannel: event.target.value })}
            >
              <option value="">Mezcla libre</option>
              {editorialChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Producto prioritario
            <select
              value={goals.priorityProduct}
              onChange={(event) => onChange({ ...goals, priorityProduct: event.target.value })}
            >
              <option value="">Sin prioridad</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Campaña prioritaria
            <input
              value={goals.priorityCampaign}
              onChange={(event) => onChange({ ...goals, priorityCampaign: event.target.value })}
            />
          </label>
        </div>
        <strong>
          DATOS OBSERVADOS · {plan.scheduled.length} programados / {goals.weekly} deseados
        </strong>
        <div className="editorial-channel-grid">
          {plan.distribution.map((entry) => (
            <span className="editorial-chip" key={entry.id}>
              {entry.label}: {entry.count}
            </span>
          ))}
        </div>
      </div>
      <IntelligencePanel
        title="Recomendación de IA · planificador editorial"
        description="Análisis determinístico de tu agenda. Sin histórico suficiente para afirmar una mejor hora o día. Cada decisión requiere intervención humana; no aprueba ni publica."
        insights={plan.recommendations.map((text, index) => ({
          id: String(index),
          title: index === 0 ? 'Siguiente acción sugerida' : 'Propuesta editorial',
          explanation: text,
          severity: 'INFO',
          source: 'Contenido visible en este workspace · reglas editoriales',
        }))}
      />
    </section>
  );
}
