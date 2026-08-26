import { describe, expect, it } from 'vitest';
import { canConfirmPreview, catalogIsExecutionSafe, operationRiskClass, parseOperationPayload } from '../src/pages/operation-console-policy';

const catalogEntry = {
  operationCode: 'ORDER_CONFIRM',
  functionName: 'confirm_order_controlled',
  domainCode: 'ORDERS',
  riskLevel: 'HIGH',
  actionKind: 'CONFIRM',
  requiresConfirmation: true,
  executionEnabled: false,
  ownerAdminOnly: true,
  description: 'Confirmar pedido.',
} as const;

describe('operation console policy', () => {
  it('accepts only JSON objects as preview payload', () => {
    expect(parseOperationPayload('{"order_id":"123"}')).toEqual({ order_id: '123' });
    expect(parseOperationPayload('')).toEqual({});
    expect(() => parseOperationPayload('[1,2]')).toThrow('objeto JSON');
  });

  it('marks HIGH and CRITICAL operations as alert risk', () => {
    expect(operationRiskClass('HIGH')).toBe('status-alert');
    expect(operationRiskClass('CRITICAL')).toBe('status-alert');
    expect(operationRiskClass('MEDIUM')).toBe('status-pass');
  });

  it('allows confirmation only for a non-executing PREVIEWED intent', () => {
    expect(canConfirmPreview({
      intentId: 'intent-1', operationKey: 'key-1', operationCode: 'ORDER_CONFIRM', domainCode: 'ORDERS',
      riskLevel: 'HIGH', actionKind: 'CONFIRM', requiresConfirmation: true, executionEnabled: false,
      status: 'PREVIEWED', confirmationToken: 'token-1', previewSnapshot: {}, expiresAt: new Date(),
    })).toBe(true);
  });

  it('requires every catalog operation to remain execution disabled', () => {
    expect(catalogIsExecutionSafe([catalogEntry])).toBe(true);
    expect(catalogIsExecutionSafe([{ ...catalogEntry, executionEnabled: true }])).toBe(false);
  });
});
