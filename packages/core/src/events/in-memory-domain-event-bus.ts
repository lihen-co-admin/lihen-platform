import type { DomainEvent } from './domain-event';
import type { DomainEventBus, DomainEventHandler } from './domain-event-bus';

export class InMemoryDomainEventBus implements DomainEventBus {
  private readonly handlers = new Map<string, Set<DomainEventHandler>>();

  subscribe(eventType: string, handler: DomainEventHandler): () => void {
    const current = this.handlers.get(eventType) ?? new Set<DomainEventHandler>();
    current.add(handler);
    this.handlers.set(eventType, current);

    return () => {
      current.delete(handler);
      if (current.size === 0) this.handlers.delete(eventType);
    };
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers) return;

    for (const handler of handlers) {
      await handler.handle(event);
    }
  }

  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) await this.publish(event);
  }
}
