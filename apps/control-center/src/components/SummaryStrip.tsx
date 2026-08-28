interface SummaryItem {
  readonly label: string;
  readonly value: string | number;
  readonly detail?: string;
}

interface SummaryStripProps {
  readonly items: readonly SummaryItem[];
}

export function SummaryStrip({ items }: SummaryStripProps) {
  return (
    <dl className="summary-strip" aria-label="Resumen operativo">
      {items.map((item) => (
        <div className="summary-strip__item" key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            <strong>{item.value}</strong>
            {item.detail ? <small>{item.detail}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
