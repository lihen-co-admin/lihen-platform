# TANDA 14 — Supplier Pilot Source Audit
## CUT 3 — static evidence only

This report is generated locally from the current repository.
It does not change `.env`, call Supabase, run migrations, or touch PROD.

## Source evidence
- `controlled_mode`: **SOURCE EVIDENCE FOUND**
- `controlled_rpc`: **SOURCE EVIDENCE FOUND**
- `operation_key`: **SOURCE EVIDENCE FOUND**
- `authorization_source_evidence`: **SOURCE EVIDENCE FOUND**
- `audit_source_evidence`: **SOURCE EVIDENCE FOUND**

## Runtime proof intentionally NOT executed
- compensation: NOT_EXECUTED
- isolated fixture: NOT_EXECUTED
- post-write read: NOT_EXECUTED
- idempotency replay: NOT_EXECUTED

## Safety conclusion
A first supplier mutation remains blocked until missing source evidence is reviewed
and all four runtime proofs are executed deliberately in Supabase DEV.

## Evidence locations
### CONTROLLED_MODE
- `apps/control-center/.env.example:18` — `VITE_SUPPLIER_WRITE_MODE=blocked`
- `apps/control-center/src/composition/finance.ts:3` — `controlledWriteEnabled:controlled}),canWrite:controlled,ids:new UuidGenerator()};}`
- `apps/control-center/src/composition/inventory.ts:18` — `controlledWriteEnabled: controlled })`
- `apps/control-center/src/composition/orders.ts:5` — `controlledWriteEnabled:controlled}):new InMemoryOrderRepository();return{repository,getOrders:new GetOrdersHandler(repository),createDraft:new CreateOrderDraftHandler(repository),confirm:new ConfirmOrderHandler(repositor`
- `apps/control-center/src/composition/procurement.ts:5` — `controlledWriteEnabled:controlled}):new InMemoryPurchaseRepository();return{repository,getPurchases:new GetPurchasesHandler(repository),createDraft:new CreatePurchaseDraftHandler(repository),confirm:new ConfirmPurchaseHa`
- `apps/control-center/src/composition/products.ts:128` — `controlledWriteEnabled: productImageWriteEnabled,`
- `apps/control-center/src/composition/sales.ts:3` — `controlledWriteEnabled:controlled}),canWrite:controlled,ids:new UuidGenerator()};}`
- `apps/control-center/src/composition/suppliers.ts:16` — `VITE_SUPPLIER_WRITE_MODE === 'controlled';`
- `apps/control-center/src/composition/suppliers.ts:18` — `controlledWriteEnabled: controlled })`
- `apps/control-center/src/domain/operational-activation-readiness.ts:50` — `controlledWriteEnabled para mutaciones.',`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:5` — `controlledWriteEnabled?: boolean; }`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:19` — `controlledWriteEnabled: boolean;`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:20` — `controlledWriteEnabled = options.controlledWriteEnabled ?? false; }`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:20` — `controlledWriteEnabled ?? false; }`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:39` — `controlledWriteEnabled) throw new Error('SUPPLIER_WRITE_BLOCKED');`
- `packages/sales/src/infrastructure/supabase-sale-repository.ts:1` — `controlledWriteEnabled?:boolean}`
- `packages/sales/src/infrastructure/supabase-sale-repository.ts:3` — `controlledWriteEnabled??false;}async list(){const{data,error}=await this.client.from('sales').select('*').order('occurred_at',{ascending:false});if(error)throw new Error(`Unable to read sales: ${error.message}`);return((`
- `packages/products/tests/supabase-controlled-product-image-writes.test.ts:45` — `controlledWriteEnabled: true },`
- `packages/products/tests/supabase-controlled-product-image-writes.test.ts:94` — `controlledWriteEnabled: true },`
- `packages/products/src/infrastructure/supabase-product-image-repository.ts:23` — `controlledWriteEnabled?: boolean;`
- `packages/products/src/infrastructure/supabase-product-image-repository.ts:50` — `controlledWriteEnabled: boolean;`
- `packages/products/src/infrastructure/supabase-product-image-repository.ts:57` — `controlledWriteEnabled = options.controlledWriteEnabled ?? false;`
- `packages/products/src/infrastructure/supabase-product-image-repository.ts:57` — `controlledWriteEnabled ?? false;`
- `packages/products/src/infrastructure/supabase-product-image-repository.ts:93` — `controlledWriteEnabled) throw new ProductImageWriteBlockedError();`
- `packages/products/src/infrastructure/supabase-product-image-repository.ts:140` — `controlledWriteEnabled) throw new ProductImageWriteBlockedError();`

### SUPPLIER_RPC
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:36` — `create_supplier_controlled', operationKey, supplier); }`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:37` — `update_supplier_controlled', operationKey, supplier); }`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:38` — `create_supplier_controlled'|'update_supplier_controlled', operationKey: string, supplier: Supplier): Promise<Supplier> {`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:38` — `update_supplier_controlled', operationKey: string, supplier: Supplier): Promise<Supplier> {`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:40` — `create_supplier_controlled'`
- `packages/procurement/src/infrastructure/supabase-purchase-repository.ts:15` — `rpc('create_purchase_draft_controlled',{p_operation_key:command.operationKey,p_purchase_id:command.purchaseId,p_purchase_number:command.purchaseNumber,p_supplier_id:command.supplierId,p_purchase_date:command.purchaseDate`
- `database/migrations/20260822052624_phase2_5_supplier_control_center_foundation.sql:17` — `create_supplier_controlled(`
- `database/migrations/20260822052624_phase2_5_supplier_control_center_foundation.sql:90` — `update_supplier_controlled(`
- `database/migrations/20260822052624_phase2_5_supplier_control_center_foundation.sql:161` — `create_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) from public, anon;`
- `database/migrations/20260822052624_phase2_5_supplier_control_center_foundation.sql:162` — `update_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) from public, anon;`
- `database/migrations/20260822052624_phase2_5_supplier_control_center_foundation.sql:163` — `create_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) to authenticated;`
- `database/migrations/20260822052624_phase2_5_supplier_control_center_foundation.sql:164` — `update_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) to authenticated;`
- `database/migrations/20260822052624_phase2_5_supplier_control_center_foundation.sql:166` — `create_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) is 'FASE 2.5A controlled supplier create. OWNER/ADMIN ACTIVE only; idempotent.';`
- `database/migrations/20260822052624_phase2_5_supplier_control_center_foundation.sql:167` — `update_supplier_controlled(text,uuid,text,text,text,text,text,integer,text,text) is 'FASE 2.5A controlled supplier update. OWNER/ADMIN ACTIVE only; idempotent.';`
- `database/migrations/20260823032049_phase3_controlled_cutover_executor_foundation.sql:132` — `create_supplier_controlled(v_key||':create',(s->>'id')::uuid,s->>'business_name',null,null,null,nullif(s->>'city',''),nullif(s->>'average_delivery_days','')::integer,null,s->>'status');`
- `database/migrations/20260823153134_phase3_cutover_executor_failure_context_observability.sql:72` — `create_supplier_controlled(v_key||':create',(s->>'id')::uuid,s->>'business_name',null,null,null,nullif(s->>'city',''),nullif(s->>'average_delivery_days','')::integer,null,s->>'status');`
- `database/migrations/20260824034000_phase2_exit_gate_closure.sql:7` — `create_supplier_controlled','update_supplier_controlled',`
- `database/migrations/20260824034000_phase2_exit_gate_closure.sql:7` — `update_supplier_controlled',`
- `database/migrations/20260826213200_phase6_1_controlled_operationalization_foundation.sql:34` — `create_supplier_controlled','p_operation_key text'),`
- `database/migrations/20260826213200_phase6_1_controlled_operationalization_foundation.sql:35` — `update_supplier_controlled','p_operation_key text')`
- `database/migrations/20260826215000_phase6_1a_control_center_operation_catalog_foundation.sql:33` — `create_supplier_controlled','SUPPLIERS','MEDIUM','CREATE',true,false,true,'Crear un proveedor mediante entry point controlado.'),`
- `database/migrations/20260826215000_phase6_1a_control_center_operation_catalog_foundation.sql:34` — `update_supplier_controlled','SUPPLIERS','MEDIUM','UPDATE',true,false,true,'Actualizar un proveedor mediante entry point controlado.')`

### OPERATION_KEY
- `apps/control-center/src/composition/operations.ts:31` — `operationKey: string;`
- `apps/control-center/src/composition/operations.ts:52` — `operationKey: string;`
- `apps/control-center/src/composition/operations.ts:77` — `operationKey: string;`
- `apps/control-center/src/composition/operations.ts:100` — `operationKeyFirst: boolean;`
- `apps/control-center/src/composition/operations.ts:379` — `operationKey: String(row.operation_key),`
- `apps/control-center/src/composition/operations.ts:422` — `operationKeyFirst: booleanValue(row.operation_key_first),`
- `apps/control-center/src/composition/operations.ts:762` — `operationKey: string,`
- `apps/control-center/src/composition/operations.ts:767` — `p_operation_key: operationKey,`
- `apps/control-center/src/composition/operations.ts:767` — `operationKey,`
- `apps/control-center/src/composition/operations.ts:776` — `operationKey: String(row.operation_key ?? ''),`
- `apps/control-center/src/composition/operations.ts:829` — `operationKey: String(row.operation_key ?? ''),`
- `apps/control-center/src/pages/PurchaseDetailPage.tsx:147` — `operationKey: `purchase-confirm:${crypto.randomUUID()}`,`
- `apps/control-center/src/pages/PurchaseDetailPage.tsx:178` — `operationKey: `purchase-receive:${crypto.randomUUID()}`,`
- `apps/control-center/src/pages/PurchasesPage.tsx:150` — `operationKey: `purchase-draft:${crypto.randomUUID()}`,`
- `apps/control-center/src/pages/SuppliersPage.tsx:33` — `operationKey:`supplier:${form.id?'update':'create'}:${crypto.randomUUID()}`,supplierId,businessName:form.businessName,contactName:form.contactName.trim()||null,whatsapp:form.whatsapp.trim()||null,email:form.email.trim()|`
- `packages/suppliers/tests/supplier-repository.test.ts:9` — `operationKey:'a', supplierId:'s1', businessName:'  Proveedor Uno  ', contactName:null, whatsapp:null, email:null, city:'Cali', averageDeliveryDays:2, notes:null, status:'ACTIVE' });`
- `packages/suppliers/tests/supplier-repository.test.ts:10` — `operationKey:'b', supplierId:'s1', businessName:'Proveedor Uno', contactName:'Ana', whatsapp:null, email:null, city:'Cali', averageDeliveryDays:3, notes:'Confirmado', status:'ACTIVE' });`
- `packages/suppliers/src/infrastructure/in-memory-supplier-repository.ts:10` — `operationKey: string, supplier: Supplier) { if ([...this.rows.values()].some((x) => x.normalizedName === supplier.normalizedName)) throw new Error('SUPPLIER_ALREADY_EXISTS'); this.rows.set(supplier.id, supplier); return `
- `packages/suppliers/src/infrastructure/in-memory-supplier-repository.ts:11` — `operationKey: string, supplier: Supplier) { if (!this.rows.has(supplier.id)) throw new Error('SUPPLIER_NOT_FOUND'); this.rows.set(supplier.id, supplier); return supplier; }`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:36` — `operationKey: string, supplier: Supplier): Promise<Supplier> { return this.write('create_supplier_controlled', operationKey, supplier); }`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:36` — `operationKey, supplier); }`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:37` — `operationKey: string, supplier: Supplier): Promise<Supplier> { return this.write('update_supplier_controlled', operationKey, supplier); }`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:37` — `operationKey, supplier); }`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:38` — `operationKey: string, supplier: Supplier): Promise<Supplier> {`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:41` — `p_operation_key: operationKey, p_id: supplier.id, p_business_name: supplier.businessName, p_contact_name: supplier.contactName, p_whatsapp: supplier.whatsapp, p_email: supplier.email, p_city: supplier.city, p_average_del`

### AUTHORIZATION
- `apps/control-center/.env.example:24` — `administration`
- `apps/control-center/tests/dev-activation-preflight.test.ts:12` — `authorizationPolicyConfirmed: true,`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:11` — `AUTHORIZATION',`
- `apps/control-center/src/app/App.tsx:14` — `AdminPage } from '../pages/BootstrapAdminPage';`
- `apps/control-center/src/app/App.tsx:14` — `AdminPage';`
- `apps/control-center/src/app/App.tsx:33` — `admin" element={<BootstrapAdminPage />} />`
- `apps/control-center/src/app/App.tsx:33` — `AdminPage />} />`
- `apps/control-center/src/components/AppShell.tsx:39` — `Administración',`
- `apps/control-center/src/components/AppShell.tsx:92` — `Administración central</strong>`
- `apps/control-center/src/composition/operations.ts:46` — `ownerAdminOnly: boolean;`
- `apps/control-center/src/composition/operations.ts:46` — `AdminOnly: boolean;`
- `apps/control-center/src/composition/operations.ts:215` — `AuthorizationGuard {`
- `apps/control-center/src/composition/operations.ts:228` — `Authorized: boolean;`
- `apps/control-center/src/composition/operations.ts:400` — `ownerAdminOnly: booleanValue(row.owner_admin_only),`
- `apps/control-center/src/composition/operations.ts:400` — `AdminOnly: booleanValue(row.owner_admin_only),`
- `apps/control-center/src/composition/operations.ts:400` — `owner_admin_only),`
- `apps/control-center/src/composition/operations.ts:400` — `admin_only),`
- `apps/control-center/src/composition/operations.ts:632` — `AuthorizationGuard(): Promise<readonly ControlCenterOperationReleaseAuthorizationGuard[]> {`
- `apps/control-center/src/composition/operations.ts:632` — `AuthorizationGuard[]> {`
- `apps/control-center/src/composition/operations.ts:650` — `Authorized: booleanValue(row.release_authorized),`
- `apps/control-center/src/composition/operations.ts:650` — `authorized),`
- `apps/control-center/src/domain/dev-activation-preflight.ts:23` — `authorizationPolicyConfirmed: boolean;`
- `apps/control-center/src/domain/dev-activation-preflight.ts:50` — `authorizationPolicyConfirmed',`
- `apps/control-center/src/domain/dev-activation-preflight.ts:93` — `authorizationPolicyConfirmed: false,`
- `apps/control-center/src/domain/supplier-pilot-evidence.ts:11` — `AUTHORIZATION'`

### AUDIT_TRAIL
- `apps/control-center/tests/dashboard-metric-integrity.test.ts:23` — `auditedOperations: 25,`
- `apps/control-center/tests/dev-activation-preflight.test.ts:13` — `auditTraceConfirmed: true,`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:12` — `AUDIT_TRAIL',`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:39` — `AUDIT_TRAIL' ? 'MISSING' : 'CONFIRMED',`
- `apps/control-center/src/components/AppShell.tsx:45` — `auditoría', icon: '✓' }] },`
- `apps/control-center/src/composition/operations.ts:18` — `auditedOperations: number;`
- `apps/control-center/src/composition/operations.ts:27` — `AuditRow {`
- `apps/control-center/src/composition/operations.ts:74` — `TimelineRow {`
- `apps/control-center/src/composition/operations.ts:261` — `AuditEvent {`
- `apps/control-center/src/composition/operations.ts:351` — `auditedOperations: numberValue(data.audited_operations),`
- `apps/control-center/src/composition/operations.ts:351` — `audited_operations),`
- `apps/control-center/src/composition/operations.ts:368` — `Audit(limit = 50): Promise<readonly OperationalAuditRow[]> {`
- `apps/control-center/src/composition/operations.ts:368` — `AuditRow[]> {`
- `apps/control-center/src/composition/operations.ts:370` — `audit_log')`
- `apps/control-center/src/composition/operations.ts:715` — `AuditTimeline(limit = 50): Promise<readonly ControlCenterGovernanceAuditEvent[]> {`
- `apps/control-center/src/composition/operations.ts:715` — `Timeline(limit = 50): Promise<readonly ControlCenterGovernanceAuditEvent[]> {`
- `apps/control-center/src/composition/operations.ts:715` — `AuditEvent[]> {`
- `apps/control-center/src/composition/operations.ts:716` — `audit_timeline_controlled', {`
- `apps/control-center/src/composition/operations.ts:716` — `timeline_controlled', {`
- `apps/control-center/src/composition/operations.ts:723` — `timeline de governance: ${error.message}`);`
- `apps/control-center/src/composition/operations.ts:811` — `AuditTimeline(`
- `apps/control-center/src/composition/operations.ts:811` — `Timeline(`
- `apps/control-center/src/composition/operations.ts:815` — `TimelineRow[]> {`
- `apps/control-center/src/composition/operations.ts:816` — `operation_audit_timeline_controlled', {`
- `apps/control-center/src/composition/operations.ts:816` — `timeline_controlled', {`

### SUPPLIER_DOMAIN
- `apps/control-center/src/composition/suppliers.ts:3` — `CreateSupplierHandler, GetSuppliersHandler, InMemorySupplierRepository, SupabaseSupplierRepository, UpdateSupplierHandler, type SupplierRepository } from '@lihen/suppliers';`
- `apps/control-center/src/composition/suppliers.ts:3` — `SupabaseSupplierRepository, UpdateSupplierHandler, type SupplierRepository } from '@lihen/suppliers';`
- `apps/control-center/src/composition/suppliers.ts:3` — `UpdateSupplierHandler, type SupplierRepository } from '@lihen/suppliers';`
- `apps/control-center/src/composition/suppliers.ts:8` — `CreateSupplierHandler;`
- `apps/control-center/src/composition/suppliers.ts:9` — `UpdateSupplierHandler;`
- `apps/control-center/src/composition/suppliers.ts:18` — `SupabaseSupplierRepository(getBrowserSupabaseClient(env), { controlledWriteEnabled: controlled })`
- `apps/control-center/src/composition/suppliers.ts:20` — `CreateSupplierHandler(repository), updateSupplier: new UpdateSupplierHandler(repository), canWrite: parsed.VITE_PRODUCT_READ_SOURCE === 'memory' || controlled, ids: new UuidGenerator() };`
- `apps/control-center/src/composition/suppliers.ts:20` — `UpdateSupplierHandler(repository), canWrite: parsed.VITE_PRODUCT_READ_SOURCE === 'memory' || controlled, ids: new UuidGenerator() };`
- `packages/suppliers/tests/supplier-repository.test.ts:2` — `CreateSupplierHandler, InMemorySupplierRepository, UpdateSupplierHandler } from '../src';`
- `packages/suppliers/tests/supplier-repository.test.ts:2` — `UpdateSupplierHandler } from '../src';`
- `packages/suppliers/tests/supplier-repository.test.ts:7` — `CreateSupplierHandler(repo);`
- `packages/suppliers/tests/supplier-repository.test.ts:8` — `UpdateSupplierHandler(repo);`
- `packages/suppliers/src/infrastructure/supabase-supplier-repository.ts:18` — `SupabaseSupplierRepository implements SupplierRepository {`
- `packages/suppliers/src/application/commands/create-supplier.handler.ts:5` — `CreateSupplierHandler {`
- `packages/suppliers/src/application/commands/update-supplier.handler.ts:5` — `UpdateSupplierHandler {`

### SUPPLIER_MIGRATIONS
- `apps/control-center/.env.example:18` — `SUPPLIER_WRITE_MODE=blocked`
- `apps/control-center/package.json:23` — `suppliers": "workspace:*",`
- `apps/control-center/tests/dashboard-metric-integrity.test.ts:15` — `suppliersActive: 4,`
- `apps/control-center/tests/dev-activation-preflight.test.ts:40` — `SUPPLIERS', {`
- `apps/control-center/tests/dev-pilot-candidate.test.ts:5` — `suppliers as the first low-blast-radius DEV candidate', () => {`
- `apps/control-center/tests/dev-pilot-candidate.test.ts:6` — `SUPPLIERS')).toEqual({`
- `apps/control-center/tests/dev-pilot-candidate.test.ts:7` — `SUPPLIERS',`
- `apps/control-center/tests/dev-pilot-candidate.test.ts:11` — `Supplier maintenance is reference-data oriented and does not inherently create stock, order, sale or finance movements.',`
- `apps/control-center/tests/dev-pilot-candidate.test.ts:25` — `supplier pilot',`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:3` — `SupplierPilotEvidence,`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:4` — `SupplierPilotEvidenceItem,`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:5` — `supplier-pilot-evidence';`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:7` — `SupplierPilotEvidenceItem['key'][] = [`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:20` — `SupplierPilotEvidence', () => {`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:22` — `SupplierPilotEvidenceItem>((key, index) => ({`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:28` — `SupplierPilotEvidence(items);`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:37` — `SupplierPilotEvidenceItem>((key) => ({`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:43` — `SupplierPilotEvidence(items);`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:50` — `SupplierPilotEvidenceItem>((key) => ({`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:56` — `SupplierPilotEvidence(items).readyForFirstMutation).toBe(false);`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:60` — `SupplierPilotEvidenceItem>((key) => ({`
- `apps/control-center/tests/supplier-pilot-evidence.test.ts:66` — `SupplierPilotEvidence(items);`
- `apps/control-center/tests/supply-inventory-readiness.test.ts:7` — `supplierId: 'supplier-1', status: 'CONFIRMED',`
- `apps/control-center/tests/supply-inventory-readiness.test.ts:7` — `supplier-1', status: 'CONFIRMED',`
- `apps/control-center/tests/supply-inventory-reconciliation.test.ts:9` — `supplierId: 'supplier-1',`
