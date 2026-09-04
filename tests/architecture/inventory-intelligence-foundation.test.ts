import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const capabilityPath = path.join(
  root,
  'packages/intelligence-core/src/capabilities/inventory-intelligence.ts',
);
const inventoryBalancePath = path.join(
  root,
  'packages/inventory/src/domain/inventory-balance.ts',
);
const inventoryMovementPath = path.join(
  root,
  'packages/inventory/src/domain/inventory-movement.ts',
);
const inventoryRepositoryPath = path.join(
  root,
  'packages/inventory/src/ports/inventory-repository.ts',
);
const indexPath = path.join(root, 'packages/intelligence-core/src/index.ts');

const capability = fs.readFileSync(capabilityPath, 'utf8');
const inventoryBalance = fs.readFileSync(inventoryBalancePath, 'utf8');
const inventoryMovement = fs.readFileSync(inventoryMovementPath, 'utf8');
const inventoryRepository = fs.readFileSync(inventoryRepositoryPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');

describe('WAVE 8 / GAP-027 Inventory Intelligence architecture', () => {
  it('builds ANALYTICS on the existing governed Inventory read semantics', () => {
    expect(capability).toContain("capability: 'ANALYTICS'");
    expect(capability).toContain("type: 'INVENTORY'");
    expect(capability).toContain('stockOnHand');
    expect(capability).toContain('stockReserved');
    expect(capability).toContain('stockPending');
    expect(capability).toContain('stockAvailable');

    expect(inventoryBalance).toContain('stockOnHand');
    expect(inventoryBalance).toContain('stockReserved');
    expect(inventoryBalance).toContain('stockPending');
    expect(inventoryBalance).toContain('stockAvailable');
    expect(inventoryMovement).toContain('quantityDelta');
    expect(inventoryMovement).toContain('occurredAt');
    expect(inventoryRepository).toContain('listBalances');
    expect(inventoryRepository).toContain('listMovements');
  });

  it('covers the WAVE-8 inventory intelligence outcomes without inventing hidden thresholds', () => {
    expect(capability).toContain("'CRITICAL_STOCK'");
    expect(capability).toContain("'ROTATION_OBSERVED'");
    expect(capability).toContain("'OVERSTOCK'");
    expect(capability).toContain("'IMMOBILE_STOCK'");
    expect(capability).toContain("'STOCKOUT_PROJECTION'");
    expect(capability).toContain("'REPLENISHMENT_SUGGESTED'");
    expect(capability).toContain('InventoryIntelligencePolicy');
    expect(capability).toContain('criticalAvailableThreshold');
    expect(capability).toContain('overstockDaysOfCoverThreshold');
    expect(capability).toContain('immobileDaysThreshold');
    expect(capability).toContain('replenishmentTargetDaysOfCover');
  });

  it('keeps Inventory Intelligence persistence-neutral and mutation-free', () => {
    expect(capability).not.toMatch(/@supabase\//);
    expect(capability).not.toMatch(/@lihen\/database/);
    expect(capability).not.toMatch(/\.rpc\s*\(/);
    expect(capability).not.toMatch(/\.insert\s*\(/);
    expect(capability).not.toMatch(/\.update\s*\(/);
    expect(capability).not.toMatch(/recordOnHandAdjustment\s*\(/);
    expect(capability).not.toContain('record_inventory_adjustment_controlled');
  });

  it('does not create a second inventory ledger or persistence repository', () => {
    expect(capability).not.toContain('inventory_movements');
    expect(capability).not.toContain('inventory_stock');
    expect(capability).not.toContain('class Inventory');
    expect(capability).not.toContain('Repository');
  });

  it('requires governed human review for recommendations that may lead to sensitive inventory or economic action', () => {
    expect(capability).toContain("level: 'R4'");
    expect(capability).toContain("level: 'R3'");
    expect(capability).toContain('requiresHumanReview: true');
    expect(capability).toContain(
      'Intelligence must not create or repair inventory movements automatically.',
    );
  });

  it('exports Inventory Intelligence from intelligence-core', () => {
    expect(index).toContain(
      "export * from './capabilities/inventory-intelligence';",
    );
  });
});
