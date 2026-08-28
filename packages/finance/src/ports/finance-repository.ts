import type{CashClosure,CreateFinancialAccountInput,FinancialAccount,FinancialMovement,RecordCashClosureInput,RecordExpenseInput,ReverseFinancialMovementInput,TransferFundsInput}from'../domain/finance';
export interface FinanceRepository{
 listAccounts():Promise<readonly FinancialAccount[]>;
 listMovements():Promise<readonly FinancialMovement[]>;
 listLedgerMovements():Promise<readonly FinancialMovement[]>;
 listMovementsByReferences(referenceType:string,referenceIds:readonly string[]):Promise<readonly FinancialMovement[]>;
 listCashClosures():Promise<readonly CashClosure[]>;
 createAccount(input:CreateFinancialAccountInput):Promise<FinancialAccount>;
 recordExpense(input:RecordExpenseInput):Promise<void>;
 transferFunds(input:TransferFundsInput):Promise<void>;
 reverseMovement(input:ReverseFinancialMovementInput):Promise<void>;
 recordCashClosure(input:RecordCashClosureInput):Promise<CashClosure>;
}
