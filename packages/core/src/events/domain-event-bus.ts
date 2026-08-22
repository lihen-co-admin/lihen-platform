import type { DomainEvent } from './domain-event';

export interface DomainEventHandler<TEvent extends DomainEvent = DomainEvent> {
  handle(event: TEvent): Promise<void>;
}

export interface DomainEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: readonly DomainEvent[]): Promise<void>;
}
