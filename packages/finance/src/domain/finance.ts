export const financialAccountTypes=['CASH','DIGITAL_WALLET','BANK','OTHER'] as const;
export type FinancialAccountType=typeof financialAccountTypes[number];
export type FinancialAccountStatus='ACTIVE'|'INACTIVE';
export type FinancialMovementType='SALE_INCOME'|'EXPENSE'|'TRANSFER_IN'|'TRANSFER_OUT'|'ADJUSTMENT'|'REVERSAL';
export interface FinancialAccount{readonly id:string;readonly code:string;readonly name:string;readonly accountType:FinancialAccountType;readonly currency:'COP';readonly status:FinancialAccountStatus;readonly balance:number;}
export interface FinancialMovement{readonly id:string;readonly accountId:string;readonly movementType:FinancialMovementType;readonly amountSigned:number;readonly currency:'COP';readonly occurredAt:Date;readonly description:string;readonly referenceType:string|null;readonly referenceId:string|null;readonly reversalOfId:string|null;}
export interface CashClosure{readonly id:string;readonly accountId:string;readonly expectedBalance:number;readonly countedBalance:number;readonly variance:number;readonly occurredAt:Date;readonly notes:string|null;}
export interface CreateFinancialAccountInput{readonly operationKey:string;readonly id:string;readonly code:string;readonly name:string;readonly accountType:FinancialAccountType;readonly currency:'COP';}
export interface RecordExpenseInput{readonly operationKey:string;readonly movementId:string;readonly accountId:string;readonly amount:number;readonly occurredAt:Date;readonly description:string;}
export interface TransferFundsInput{readonly operationKey:string;readonly transferId:string;readonly outMovementId:string;readonly inMovementId:string;readonly fromAccountId:string;readonly toAccountId:string;readonly amount:number;readonly occurredAt:Date;readonly description:string;}
export interface ReverseFinancialMovementInput{readonly operationKey:string;readonly reversalMovementId:string;readonly originalMovementId:string;readonly occurredAt:Date;readonly reason:string;}
export interface RecordCashClosureInput{readonly operationKey:string;readonly closureId:string;readonly accountId:string;readonly countedBalance:number;readonly occurredAt:Date;readonly notes:string|null;}
export function canReverseFinancialMovement(movement:FinancialMovement):boolean{return movement.movementType==='EXPENSE'||movement.movementType==='ADJUSTMENT';}
