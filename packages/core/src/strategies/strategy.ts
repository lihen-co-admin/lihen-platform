export interface Strategy<TContext, TResult> {
  readonly key: string;
  execute(context: TContext): TResult | Promise<TResult>;
}
