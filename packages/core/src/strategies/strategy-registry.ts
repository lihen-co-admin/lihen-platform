import type { Strategy } from './strategy';

export class StrategyRegistry<TContext, TResult> {
  private readonly strategies = new Map<string, Strategy<TContext, TResult>>();

  register(strategy: Strategy<TContext, TResult>): void {
    if (this.strategies.has(strategy.key)) {
      throw new Error(`Strategy already registered: ${strategy.key}`);
    }
    this.strategies.set(strategy.key, strategy);
  }

  get(key: string): Strategy<TContext, TResult> {
    const strategy = this.strategies.get(key);
    if (!strategy) throw new Error(`Strategy not registered: ${key}`);
    return strategy;
  }

  has(key: string): boolean {
    return this.strategies.has(key);
  }
}
