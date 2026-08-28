import type { ReactNode } from 'react';
import {
  resolveOperationalNoticeSemantics,
  type OperationalNoticeTone,
} from '../domain/admin-surface-semantics';

interface OperationalNoticeProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly tone?: OperationalNoticeTone;
  readonly meta?: string;
}

export function OperationalNotice({ title, children, tone = 'info', meta }: OperationalNoticeProps) {
  const semantics = resolveOperationalNoticeSemantics(tone);

  return (
    <aside
      className={`operational-notice operational-notice--${tone}`}
      {...(semantics.role ? { role: semantics.role } : {})}
      {...(semantics.ariaLive ? { 'aria-live': semantics.ariaLive } : {})}
    >
      <span className="operational-notice__signal" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <div className="operational-notice__body">{children}</div>
        {meta ? <small>{meta}</small> : null}
      </div>
    </aside>
  );
}
