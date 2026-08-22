import type { PurchaseRepository } from '../../ports/purchase-repository';
export class GetPurchasesHandler { public constructor(private readonly repository: PurchaseRepository) {} public execute(){ return this.repository.list(); } }
