import { describe, expect, it, vi } from 'vitest';
import { InMemoryDomainEventBus, StrategyRegistry, type DomainEvent, type Strategy } from '../src/index';

describe('core events and strategies', () => {
  it('dispatches an event only to handlers subscribed to its type', async () => {
    const bus = new InMemoryDomainEventBus();
    const handle = vi.fn(async () => undefined);
    bus.subscribe('PRODUCT_CREATED', { handle });

    const event: DomainEvent<{ readonly name: string }> = {
      eventId: 'event-1',
      eventType: 'PRODUCT_CREATED',
      aggregateId: 'product-1',
      occurredAt: new Date('2026-08-22T04:30:00.000Z'),
      payload: { name: 'Producto real' },
    };

    await bus.publish(event);
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('resolves a registered strategy deterministically by key', async () => {
    const registry = new StrategyRegistry<{ value: number }, number>();
    const strategy: Strategy<{ value: number }, number> = {
      key: 'double',
      execute: ({ value }) => value * 2,
    };

    registry.register(strategy);
    expect(await registry.get('double').execute({ value: 4 })).toBe(8);
    expect(registry.has('double')).toBe(true);
  });
});
