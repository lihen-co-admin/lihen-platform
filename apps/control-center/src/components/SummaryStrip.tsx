interface SummaryItem {
  readonly label: string;
  readonly value: string | number;
  readonly detail?: string;
}

interface SummaryStripProps {
  readonly items: readonly SummaryItem[];
}

function summaryValueSize(value: string | number): 'short' | 'medium' | 'long' {
  const length = String(value).trim().length;
  if (length <= 12) return 'short';
  if (length <= 24) return 'medium';
  return 'long';
}

export function SummaryStrip({ items }: SummaryStripProps) {
  return (
    <dl className="summary-strip" aria-label="Resumen operativo">
      {items.map((item) => {
        const valueSize = summaryValueSize(item.value);

        return (
          <div
            className={`summary-strip__item summary-strip__item--value-${valueSize}`}
            key={item.label}
          >
            <dt>{item.label}</dt>
            <dd>
              <strong>{item.value}</strong>
              {item.detail ? <small>{item.detail}</small> : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
