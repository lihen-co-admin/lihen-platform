import { describe, expect, it } from 'vitest';
import {
  canConfirmPreview,
  canarySimulationIsSafe,
  catalogIsExecutionSafe,
  dispatchContractsAreHeld,
  executionReadinessIsHeld,
  operationRiskClass,
  parseOperationPayload,
  validationMessage,
} from '../src/pages/operation-console-policy';

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

  it('explains missing and unexpected payload keys', () => {
    expect(validationMessage({
      operationCode: 'ORDER_CONFIRM', valid: false, payloadIsObject: true,
      missingRequiredKeys: ['p_order_id'], unexpectedKeys: [], expectedArguments: [],
      executionEnabled: false, validationNote: 'MISSING_REQUIRED_KEYS',
    })).toContain('p_order_id');
    expect(validationMessage({
      operationCode: 'ORDER_CONFIRM', valid: false, payloadIsObject: true,
      missingRequiredKeys: [], unexpectedKeys: ['hack'], expectedArguments: [],
      executionEnabled: false, validationNote: 'UNEXPECTED_KEYS',
    })).toContain('hack');
  });

  it('accepts readiness only while every operation is explicitly held', () => {
    expect(executionReadinessIsHeld([{
      operationCode: 'ORDER_CONFIRM', domainCode: 'ORDERS', riskLevel: 'HIGH',
      catalogExecutionEnabled: false, releaseStatus: 'HELD', allowedEnvironment: 'DEV_ONLY',
      requiresExplicitRelease: true, maxExecutionAttemptsPerHour: 0, readinessStatus: 'READY_BUT_HELD',
    }])).toBe(true);
  });

  it('keeps every compiled dispatch contract held', () => {
    expect(dispatchContractsAreHeld([{
      operationCode: 'ORDER_CREATE_DRAFT', domainCode: 'ORDERS', riskLevel: 'MEDIUM',
      functionName: 'create_order_draft_controlled', identityArguments: '', resultSignature: '',
      payloadArguments: [], releaseStatus: 'HELD', allowedEnvironment: 'DEV_ONLY',
      maxExecutionAttemptsPerHour: 0, dispatchAllowed: false,
      dispatchStatus: 'COMPILED_BUT_DISPATCH_HELD',
    }])).toBe(true);
  });

  it('accepts canary simulation only while canary and dispatch stay disabled', () => {
    expect(canarySimulationIsSafe([{
      operationCode: 'ORDER_CREATE_DRAFT', domainCode: 'ORDERS', riskLevel: 'MEDIUM',
      functionName: 'create_order_draft_controlled', canaryEligible: true, canaryEnabled: false,
      maxCanaryAttemptsPerHour: 0, requiresManualRelease: true, allowedEnvironment: 'DEV_ONLY',
      dispatchAllowed: false, dispatchStatus: 'COMPILED_BUT_DISPATCH_HELD',
      simulationStatus: 'SIMULATION_READY_BUT_DISABLED',
    }])).toBe(true);
  });
});
