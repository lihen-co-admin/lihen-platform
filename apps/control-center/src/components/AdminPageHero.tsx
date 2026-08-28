import type { ReactNode } from 'react';

interface AdminPageHeroProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description: string;
  readonly status?: ReactNode;
  readonly actions?: ReactNode;
  readonly accent?: 'neutral' | 'pink' | 'lilac' | 'lime' | 'gold';
}

export function AdminPageHero({
  eyebrow = 'LIHEN CONTROL CENTER',
  title,
  description,
  status,
  actions,
  accent = 'neutral',
}: AdminPageHeroProps) {
  return (
    <header className={`admin-page-hero admin-page-hero--${accent}`}>
      <div className="admin-page-hero__content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="admin-page-hero__description">{description}</p>
        {actions ? <div className="admin-page-hero__actions">{actions}</div> : null}
      </div>
      {status ? (
        <aside className="admin-page-hero__status" aria-label="Estado de la página">
          {status}
        </aside>
      ) : null}
    </header>
  );
}
