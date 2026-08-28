import { describe, expect, it } from 'vitest';
import {
  summarizeSupplierPilotEvidence,
  type SupplierPilotEvidenceItem,
} from '../src/domain/supplier-pilot-evidence';

const keys: SupplierPilotEvidenceItem['key'][] = [
  'CONTROLLED_MODE',
  'CONTROLLED_RPC',
  'OPERATION_KEY',
  'AUTHORIZATION',
  'AUDIT_TRAIL',
  'COMPENSATION',
  'ISOLATED_FIXTURE',
  'POST_WRITE_READ',
  'IDEMPOTENCY_REPLAY',
  'PROD_UNTOUCHED',
];

describe('summarizeSupplierPilotEvidence', () => {
  it('keeps the first mutation blocked while runtime evidence is pending', () => {
    const items = keys.map<SupplierPilotEvidenceItem>((key, index) => ({
      key,
      status: index < 6 ? 'CONFIRMED' : 'NEEDS_RUNTIME_PROOF',
      note: key,
    }));

    const result = summarizeSupplierPilotEvidence(items);

    expect(result.sourceConfirmed).toBe(6);
    expect(result.runtimeProofPending).toBe(4);
    expect(result.readyForFirstMutation).toBe(false);
    expect(result.executionPlaneMustRemainHeld).toBe(true);
  });

  it('keeps the pilot blocked when any evidence item is missing', () => {
    const items = keys.map<SupplierPilotEvidenceItem>((key) => ({
      key,
      status: key === 'AUDIT_TRAIL' ? 'MISSING' : 'CONFIRMED',
      note: key,
    }));

    const result = summarizeSupplierPilotEvidence(items);

    expect(result.missing).toBe(1);
    expect(result.readyForFirstMutation).toBe(false);
  });

  it('requires the complete ten-item evidence set', () => {
    const items = keys.slice(0, 9).map<SupplierPilotEvidenceItem>((key) => ({
      key,
      status: 'CONFIRMED',
      note: key,
    }));

    expect(summarizeSupplierPilotEvidence(items).readyForFirstMutation).toBe(false);
  });

  it('allows readiness only after every source and runtime proof is confirmed', () => {
    const items = keys.map<SupplierPilotEvidenceItem>((key) => ({
      key,
      status: 'CONFIRMED',
      note: key,
    }));

    const result = summarizeSupplierPilotEvidence(items);

    expect(result.sourceConfirmed).toBe(10);
    expect(result.runtimeProofPending).toBe(0);
    expect(result.missing).toBe(0);
    expect(result.readyForFirstMutation).toBe(true);
    expect(result.executionPlaneMustRemainHeld).toBe(true);
  });
});
