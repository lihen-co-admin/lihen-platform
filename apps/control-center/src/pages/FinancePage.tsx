import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  canReverseFinancialMovement,
  evaluateFinanceLedgerIntegrity,
  evaluateFinanceOperationPolicy,
  evaluateFinanceReadiness,
  financialAccountTypes,
  type CashClosure,
  type FinancialAccount,
  type FinancialAccountType,
  type FinancialMovement,
} from '@lihen/finance';
import { AdminPageHero } from '../components/AdminPageHero';
import { IntelligencePanel, type IntelligenceInsight } from '../components/IntelligencePanel';
import { OperationalNotice } from '../components/OperationalNotice';
import { SummaryStrip } from '../components/SummaryStrip';
import { financeComposition } from '../composition/finance';

function money(value: number) {
  return `$${value.toLocaleString('es-CO')}`;
}

export function FinancePage() {
  const [accounts, setAccounts] = useState<readonly FinancialAccount[]>([]);
  const [movements, setMovements] = useState<readonly FinancialMovement[]>([]);
  const [ledgerMovements, setLedgerMovements] = useState<readonly FinancialMovement[]>([]);
  const [closures, setClosures] = useState<readonly CashClosure[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<FinancialAccountType>('CASH');
  const [expenseAccount, setExpenseAccount] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');
  const [closureAccount, setClosureAccount] = useState('');
  const [countedBalance, setCountedBalance] = useState('');
  const [closureNotes, setClosureNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    const [nextAccounts, nextMovements, nextLedgerMovements, nextClosures] = await Promise.all([
      financeComposition.repository.listAccounts(),
      financeComposition.repository.listMovements(),
      financeComposition.repository.listLedgerMovements(),
      financeComposition.repository.listCashClosures(),
    ]);
    setAccounts(nextAccounts);
    setMovements(nextMovements);
    setLedgerMovements(nextLedgerMovements);
    setClosures(nextClosures);
    const nextActiveAccounts = nextAccounts.filter((account) => account.status === 'ACTIVE');
    if (nextActiveAccounts.length > 0) {
      setExpenseAccount((current) => nextActiveAccounts.some((account) => account.id === current) ? current : nextActiveAccounts[0]!.id);
      setFromAccount((current) => nextActiveAccounts.some((account) => account.id === current) ? current : nextActiveAccounts[0]!.id);
      setToAccount((current) => nextActiveAccounts.some((account) => account.id === current) ? current : nextActiveAccounts[Math.min(1, nextActiveAccounts.length - 1)]!.id);
      setClosureAccount((current) => nextActiveAccounts.some((account) => account.id === current) ? current : nextActiveAccounts[0]!.id);
    }
  }

  useEffect(() => {
    refresh().catch((cause) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar finanzas.'));
  }, []);

  async function run(action: () => Promise<string>) {
    setError('');
    setMessage('');
    try {
      const text = await action();
      setMessage(text);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible completar la operación financiera.');
    }
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await financeComposition.repository.createAccount({
        operationKey: `finance-account:${crypto.randomUUID()}`,
        id: financeComposition.ids.generate(),
        code,
        name,
        accountType: type,
        currency: 'COP',
      });
      setCode('');
      setName('');
      return 'Cuenta creada con saldo inicial 0.';
    });
  }

  async function recordExpense(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const amount = Number(expenseAmount);
      const policy = evaluateFinanceOperationPolicy({
        operation: 'EXPENSE',
        account: accounts.find((account) => account.id === expenseAccount) ?? null,
        amount,
        readinessStatus: financeReadiness.status,
        ledgerIntegrityStatus: ledgerIntegrity.status,
      });
      if (policy.status === 'BLOCKED') throw new Error(policy.issues.map((issue) => issue.message).join(' '));
      await financeComposition.repository.recordExpense({
        operationKey: `expense:${crypto.randomUUID()}`,
        movementId: financeComposition.ids.generate(),
        accountId: expenseAccount,
        amount,
        occurredAt: new Date(),
        description: expenseDescription,
      });
      setExpenseAmount('');
      setExpenseDescription('');
      return 'Egreso registrado en el ledger.';
    });
  }

  async function transfer(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const amount = Number(transferAmount);
      const policy = evaluateFinanceOperationPolicy({
        operation: 'TRANSFER',
        fromAccount: accounts.find((account) => account.id === fromAccount) ?? null,
        toAccount: accounts.find((account) => account.id === toAccount) ?? null,
        amount,
        readinessStatus: financeReadiness.status,
        ledgerIntegrityStatus: ledgerIntegrity.status,
      });
      if (policy.status === 'BLOCKED') throw new Error(policy.issues.map((issue) => issue.message).join(' '));
      await financeComposition.repository.transferFunds({
        operationKey: `transfer:${crypto.randomUUID()}`,
        transferId: financeComposition.ids.generate(),
        outMovementId: financeComposition.ids.generate(),
        inMovementId: financeComposition.ids.generate(),
        fromAccountId: fromAccount,
        toAccountId: toAccount,
        amount,
        occurredAt: new Date(),
        description: transferDescription,
      });
      setTransferAmount('');
      setTransferDescription('');
      return 'Transferencia registrada de forma balanceada.';
    });
  }

  async function closeCash(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const nextCountedBalance = Number(countedBalance);
      const notes = closureNotes.trim() || null;
      const policy = evaluateFinanceOperationPolicy({
        operation: 'CASH_CLOSURE',
        account: accounts.find((account) => account.id === closureAccount) ?? null,
        countedBalance: nextCountedBalance,
        notes,
        readinessStatus: financeReadiness.status,
        ledgerIntegrityStatus: ledgerIntegrity.status,
      });
      if (policy.status === 'BLOCKED') throw new Error(policy.issues.map((issue) => issue.message).join(' '));
      const closure = await financeComposition.repository.recordCashClosure({
        operationKey: `cash-closure:${crypto.randomUUID()}`,
        closureId: financeComposition.ids.generate(),
        accountId: closureAccount,
        countedBalance: nextCountedBalance,
        occurredAt: new Date(),
        notes,
      });
      setCountedBalance('');
      setClosureNotes('');
      return `Cierre registrado. Diferencia: ${money(closure.variance)}.`;
    });
  }

  async function reverse(movement: FinancialMovement) {
    const policy = evaluateFinanceOperationPolicy({
      operation: 'REVERSAL',
      movement,
      ledgerMovements,
      readinessStatus: financeReadiness.status,
      ledgerIntegrityStatus: ledgerIntegrity.status,
    });
    if (policy.status === 'BLOCKED') {
      setError(policy.issues.map((issue) => issue.message).join(' '));
      return;
    }
    const reason = window.prompt('Motivo de la reversión');
    if (!reason?.trim()) return;
    await run(async () => {
      await financeComposition.repository.reverseMovement({
        operationKey: `finance-reversal:${crypto.randomUUID()}`,
        reversalMovementId: financeComposition.ids.generate(),
        originalMovementId: movement.id,
        occurredAt: new Date(),
        reason: reason.trim(),
      });
      return 'Movimiento revertido mediante contramovimiento; el original se conserva.';
    });
  }

  const activeAccounts = accounts.filter((account) => account.status === 'ACTIVE');
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const salesIncome = ledgerMovements.filter((movement) => movement.movementType === 'SALE_INCOME').reduce((sum, movement) => sum + movement.amountSigned, 0);
  const expenses = ledgerMovements.filter((movement) => movement.movementType === 'EXPENSE').reduce((sum, movement) => sum + Math.abs(movement.amountSigned), 0);
  const closuresWithVariance = closures.filter((closure) => Math.abs(closure.variance) > 0.009);
  const hasAccounts = accounts.length > 0;
  const financeReadiness = useMemo(() => evaluateFinanceReadiness({ accounts, movements: ledgerMovements, closures }), [accounts, closures, ledgerMovements]);
  const ledgerIntegrity = useMemo(() => evaluateFinanceLedgerIntegrity({ accounts, movements: ledgerMovements, closures }), [accounts, closures, ledgerMovements]);
  const ordinaryFinancialWritesBlocked = financeReadiness.status === 'BLOCKED' || ledgerIntegrity.status === 'BLOCKED';
  const hasActiveAccounts = activeAccounts.length > 0;
  const reversedMovementIds = useMemo(
    () => new Set(ledgerMovements.filter((movement) => movement.reversalOfId).map((movement) => movement.reversalOfId as string)),
    [ledgerMovements],
  );

  const insights = useMemo<readonly IntelligenceInsight[]>(() => {
    const next: IntelligenceInsight[] = [];
    if (!hasAccounts) {
      next.push({
        id: 'finance-no-accounts',
        severity: 'WARNING',
        title: 'Aún no hay cuentas financieras canónicas',
        explanation: 'Ventas, egresos, transferencias y cierres dependen de cuentas registradas dentro del ledger.',
        source: 'Cuentas financieras',
      });
    }
    if (closuresWithVariance.length > 0) {
      next.push({
        id: 'finance-closure-variance',
        severity: 'WARNING',
        title: `${closuresWithVariance.length} cierre${closuresWithVariance.length === 1 ? '' : 's'} presenta${closuresWithVariance.length === 1 ? '' : 'n'} diferencia`,
        explanation: 'Una diferencia no se corrige sobrescribiendo saldo. Debe investigarse su causa y registrarse mediante el flujo financiero correspondiente.',
        source: 'Cierres de caja',
      });
    }
    if (ledgerIntegrity.status === 'BLOCKED') {
      next.push({
        id: 'finance-ledger-integrity-blocked',
        severity: 'CRITICAL',
        title: 'Integridad del ledger bloqueada',
        explanation: `${ledgerIntegrity.issues.filter((issue) => issue.severity === 'CRITICAL').length} diferencia(s) crítica(s) entre saldos derivados, movimientos o cierres deben investigarse antes de operar.`,
        source: 'Ledger integrity',
      });
    } else if (ledgerIntegrity.status === 'REVIEW') {
      next.push({
        id: 'finance-ledger-integrity-review',
        severity: 'WARNING',
        title: 'Ledger financiero en revisión',
        explanation: 'Los saldos derivados son consistentes, pero existen diferencias de cierre que deben justificarse sin sobrescribir movimientos históricos.',
        source: 'Ledger integrity',
      });
    }
    if (financeReadiness.status === 'BLOCKED') {
      next.push({
        id: 'finance-readiness-blocked',
        severity: 'CRITICAL',
        title: 'Readiness financiero bloqueado',
        explanation: `${financeReadiness.issues.filter((issue) => issue.severity === 'CRITICAL').length} inconsistencia(s) crítica(s) requieren revisión del ledger antes de confiar en la operación financiera.`,
        source: 'Finance readiness',
      });
    } else if (financeReadiness.status === 'REVIEW') {
      next.push({
        id: 'finance-readiness-review',
        severity: 'WARNING',
        title: 'Readiness financiero en revisión',
        explanation: 'El ledger conserva su trazabilidad, pero existen diferencias de cierre u otras señales que deben investigarse.',
        source: 'Finance readiness',
      });
    }
    if (accounts.length > 0 && activeAccounts.length === 0) {
      next.push({
        id: 'finance-no-active-account',
        severity: 'CRITICAL',
        title: 'No existe una cuenta financiera activa',
        explanation: 'Los flujos comerciales que requieren ingreso financiero no deberían avanzar hasta recuperar una cuenta operativa válida.',
        source: 'Cuentas financieras',
      });
    }
    if (next.length === 0) {
      next.push({
        id: 'finance-ledger-healthy',
        severity: 'SUCCESS',
        title: 'Ledger financiero disponible para operación controlada',
        explanation: 'Los saldos siguen derivados de movimientos y las reversas conservan historia mediante contramovimientos.',
        source: 'Ledger financiero',
      });
    }
    return next;
  }, [activeAccounts.length, accounts.length, closuresWithVariance.length, financeReadiness, hasAccounts, ledgerIntegrity]);

  return (
    <section className="stack">
      <AdminPageHero
        eyebrow="FINANZAS"
        title="Caja y finanzas"
        description="Administra cuentas, egresos, transferencias y cierres sin perder el origen de cada peso: los saldos se derivan del ledger, no se editan manualmente."
        accent="gold"
        status={<><strong>{financeComposition.canWrite ? 'Operación controlada disponible' : 'Escritura bloqueada'}</strong><p>Reversiones mediante contramovimiento.</p></>}
      />

      <SummaryStrip items={[
        { label: 'Cuentas', value: accounts.length, detail: `${activeAccounts.length} activas` },
        { label: 'Saldo derivado', value: money(totalBalance), detail: 'todas las cuentas' },
        { label: 'Ingresos por ventas', value: money(salesIncome), detail: 'movimientos SALE_INCOME' },
        { label: 'Egresos', value: money(expenses), detail: 'movimientos EXPENSE' },
        { label: 'Cierres con diferencia', value: closuresWithVariance.length, detail: 'requieren revisión' },
        { label: 'Readiness', value: financeReadiness.status, detail: `${financeReadiness.issues.length} señal(es)` },
        { label: 'Ledger', value: ledgerIntegrity.status, detail: `${ledgerIntegrity.movementCount} movimientos auditados` },
      ]} />

      <OperationalNotice title="Ledger inmutable" tone="info" meta="Trazabilidad financiera">
        <p>Los saldos se calculan desde movimientos. Una reversión agrega un contramovimiento y conserva el original. Transferencias deben permanecer balanceadas; ventas no se revierten aquí porque requieren su flujo de dominio completo.</p>
      </OperationalNotice>

      <IntelligencePanel insights={insights} />

      {ordinaryFinancialWritesBlocked ? (
        <OperationalNotice title="Operación financiera ordinaria protegida" tone="warning" meta="Guard de integridad">
          <p>Egresos, transferencias y nuevos cierres quedan bloqueados mientras el readiness o la integridad del ledger estén en estado crítico. Crear una cuenta de recuperación y una reversión controlada válida siguen siendo acciones separadas.</p>
        </OperationalNotice>
      ) : null}

      {message ? <div className="info-state">{message}</div> : null}
      {error ? <div className="error-state">{error}</div> : null}

      {financeComposition.canWrite ? (
        <>
          <form className="card stack" onSubmit={createAccount}>
            <div><span className="eyebrow">CONFIGURACIÓN</span><h2>Nueva cuenta operativa</h2><p>Una cuenta nueva comienza en cero; su saldo se construye únicamente desde movimientos.</p></div>
            <div className="form-grid">
              <label><span>Código</span><input required value={code} onChange={(event) => setCode(event.target.value)} /></label>
              <label><span>Nombre</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label><span>Tipo</span><select value={type} onChange={(event) => setType(event.target.value as FinancialAccountType)}>{financialAccountTypes.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}</select></label>
            </div>
            <button type="submit">Crear cuenta</button>
          </form>

          {hasActiveAccounts ? (
            <div className="form-grid">
              <form className="card stack" onSubmit={recordExpense}>
                <div><span className="eyebrow">SALIDA</span><h2>Registrar egreso</h2></div>
                <label><span>Cuenta</span><select required value={expenseAccount} onChange={(event) => setExpenseAccount(event.target.value)}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {money(account.balance)}</option>)}</select></label>
                <label><span>Valor</span><input required min="0.01" step="0.01" type="number" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} /></label>
                <label><span>Descripción</span><input required value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} /></label>
                <button type="submit" disabled={ordinaryFinancialWritesBlocked}>Registrar egreso</button>
              </form>

              <form className="card stack" onSubmit={transfer}>
                <div><span className="eyebrow">MOVIMIENTO INTERNO</span><h2>Transferir entre cuentas</h2></div>
                <label><span>Desde</span><select required value={fromAccount} onChange={(event) => setFromAccount(event.target.value)}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                <label><span>Hacia</span><select required value={toAccount} onChange={(event) => setToAccount(event.target.value)}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                <label><span>Valor</span><input required min="0.01" step="0.01" type="number" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} /></label>
                <label><span>Descripción</span><input required value={transferDescription} onChange={(event) => setTransferDescription(event.target.value)} /></label>
                <button type="submit" disabled={ordinaryFinancialWritesBlocked || fromAccount === toAccount || activeAccounts.length < 2}>Transferir</button>
              </form>

              <form className="card stack" onSubmit={closeCash}>
                <div><span className="eyebrow">CONCILIACIÓN</span><h2>Cierre / conteo</h2></div>
                <label><span>Cuenta</span><select required value={closureAccount} onChange={(event) => setClosureAccount(event.target.value)}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                <label><span>Saldo contado</span><input required step="0.01" type="number" value={countedBalance} onChange={(event) => setCountedBalance(event.target.value)} /></label>
                <label><span>Nota</span><input value={closureNotes} onChange={(event) => setClosureNotes(event.target.value)} /></label>
                <button type="submit" disabled={ordinaryFinancialWritesBlocked}>Registrar cierre</button>
              </form>
            </div>
          ) : (
            <OperationalNotice title="Primero crea o activa una cuenta operativa" tone="warning"><p>No se importan saldos legacy automáticamente. La reconciliación debe mantenerse separada y trazable.</p></OperationalNotice>
          )}
        </>
      ) : (
        <OperationalNotice title="Escritura financiera bloqueada" tone="warning"><p>La vista permanece disponible para lectura, pero los comandos financieros no están habilitados por configuración.</p></OperationalNotice>
      )}

      <div className="card stack">
        <div><span className="eyebrow">LEDGER CHECK</span><h2>Conciliación de saldos y cierres</h2><p>Contrasta cada saldo visible con la suma completa del ledger y valida el saldo esperado de cada cierre contra la cronología real de movimientos.</p></div>
        {ledgerIntegrity.issues.length === 0 ? <p>Los saldos de cuenta y los cierres coinciden con el ledger completo disponible.</p> : (
          <div className="table-wrap"><table><thead><tr><th>Severidad</th><th>Señal</th><th>Referencia</th></tr></thead><tbody>{ledgerIntegrity.issues.map((issue, index) => <tr key={`${issue.code}:${issue.referenceId ?? index}`}><td>{issue.severity}</td><td><strong>{issue.code}</strong><br />{issue.message}</td><td>{issue.referenceId ?? '—'}</td></tr>)}</tbody></table></div>
        )}
      </div>

      <div className="card stack">
        <div><span className="eyebrow">READINESS</span><h2>Integridad financiera</h2><p>Lectura determinística del ledger; no corrige ni compensa movimientos automáticamente.</p></div>
        {financeReadiness.issues.length === 0 ? <p>No se detectaron inconsistencias estructurales en cuentas, transferencias, reversos o cierres.</p> : (
          <div className="table-wrap"><table><thead><tr><th>Severidad</th><th>Señal</th><th>Referencia</th></tr></thead><tbody>{financeReadiness.issues.map((issue, index) => <tr key={`${issue.code}:${issue.referenceId ?? index}`}><td>{issue.severity}</td><td><strong>{issue.code}</strong><br />{issue.message}</td><td>{issue.referenceId ?? '—'}</td></tr>)}</tbody></table></div>
        )}
      </div>

      <div className="card stack">
        <div><span className="eyebrow">SALDOS</span><h2>Cuentas</h2></div>
        <div className="table-wrap"><table><thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Estado</th><th>Saldo</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td>{account.code}</td><td><strong>{account.name}</strong></td><td>{account.accountType}</td><td>{account.status}</td><td>{money(account.balance)}</td></tr>)}</tbody></table></div>
        {accounts.length === 0 ? <p>No hay cuentas canónicas todavía. Este estado es válido antes de iniciar la reconciliación financiera.</p> : null}
      </div>

      <div className="card stack">
        <div><span className="eyebrow">LEDGER</span><h2>Últimos movimientos</h2></div>
        <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Valor</th><th>Acción</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{movement.occurredAt.toLocaleString()}</td><td>{movement.movementType}</td><td>{movement.description}</td><td>{money(movement.amountSigned)}</td><td>{financeComposition.canWrite && canReverseFinancialMovement(movement) && !movement.reversalOfId && !reversedMovementIds.has(movement.id) ? <button type="button" onClick={() => void reverse(movement)}>Revertir</button> : '—'}</td></tr>)}</tbody></table></div>
        {movements.length === 0 ? <p>No hay movimientos financieros operativos todavía.</p> : null}
      </div>

      <div className="card stack">
        <div><span className="eyebrow">CONCILIACIÓN</span><h2>Últimos cierres</h2></div>
        <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Cuenta</th><th>Esperado</th><th>Contado</th><th>Diferencia</th></tr></thead><tbody>{closures.map((closure) => <tr key={closure.id}><td>{closure.occurredAt.toLocaleString()}</td><td>{accounts.find((account) => account.id === closure.accountId)?.name ?? closure.accountId}</td><td>{money(closure.expectedBalance)}</td><td>{money(closure.countedBalance)}</td><td>{money(closure.variance)}</td></tr>)}</tbody></table></div>
        {closures.length === 0 ? <p>No hay cierres registrados todavía.</p> : null}
      </div>
    </section>
  );
}
