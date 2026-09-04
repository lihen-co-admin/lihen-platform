import { describe, expect, it } from 'vitest';
import type { Logger, LogContext } from '../src/index';

describe('core observability logging contract', () => {
  it('accepts correlation and external provider/API observability context', () => {
    const captured: Array<{ message: string; context?: LogContext }> = [];

    const logger: Logger = {
      debug: (message, context) => captured.push({ message, context }),
      info: (message, context) => captured.push({ message, context }),
      warn: (message, context) => captured.push({ message, context }),
      error: (message, context) => captured.push({ message, context }),
    };

    const context = {
      module: 'INTELLIGENCE',
      operation: 'MODEL_COMPLETE',
      operationKey: 'operation-42',
      correlationId: 'corr-42',
      requestId: 'request-42',
      providerRef: 'provider-neutral',
      requestRef: 'remote-request-42',
      durationMs: 125,
      providerStatus: 'SUCCESS',
    } satisfies LogContext;

    logger.info('External provider call completed.', context);

    expect(captured).toEqual([
      {
        message: 'External provider call completed.',
        context,
      },
    ]);
  });

  it('preserves the existing minimal logging context contract', () => {
    const context = {
      module: 'PRODUCTS',
      operation: 'READ',
      entityId: 'product-1',
      operationKey: 'product-read-1',
      errorCode: 'NONE',
    } satisfies LogContext;

    expect(context.operationKey).toBe('product-read-1');
  });
});
