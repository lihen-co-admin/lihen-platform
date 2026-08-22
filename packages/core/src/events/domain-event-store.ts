import type { DomainEvent } from './domain-event';

export interface StoredDomainEvent<TPayload = unknown> extends DomainEvent<TPayload> {
  readonly aggregateType: string;
  readonly recordedAt: Date;
  readonly actorId: string | null;
  readonly correlationId: string | null;
  readonly causationId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface DomainEventStore {
  append(event: StoredDomainEvent): Promise<void>;
  listForAggregate(aggregateType: string, aggregateId: string): Promise<readonly StoredDomainEvent[]>;
}
