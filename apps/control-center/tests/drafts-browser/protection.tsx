import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Link, Outlet, RouterProvider, useNavigate } from 'react-router-dom';
import {
  UnsavedChangesProvider,
  useConfirmUnsavedExit,
  useUnsavedValue,
} from '../../src/drafts/UnsavedChanges';
import { FormDraftProvider } from '../../src/drafts/FormDraftProvider';
import { PurchasesPage } from '../../src/pages/PurchasesPage';
import { EditorialScheduling } from '../../src/components/EditorialScheduling';
import { createEditorialDraft } from '../../src/composition/editorial-workspace';
import { SuppliersPage } from '../../src/pages/SuppliersPage';
import { suppliersComposition } from '../../src/composition/suppliers';
import { procurementComposition } from '../../src/composition/procurement';
import { productsComposition } from '../../src/composition/products';

// Local fixtures only. No real auth session or Supabase transport.
suppliersComposition.getSuppliers.execute = async () => [];
procurementComposition.getPurchases.execute = async () => [];
productsComposition.getProducts.execute = async () => [];
const scheduleFixture = createEditorialDraft(
  {
    copy: 'Fixture',
    callToAction: '',
    hashtags: '',
    creativeAssetIds: ['asset-a'],
    channels: ['INSTAGRAM_FEED'],
    productId: 'product-a',
    campaignName: '',
    date: '',
  },
  new Date('2026-10-20T12:00:00Z'),
  () => crypto.randomUUID(),
)[0]!;
function SessionActions({ change }: { change: (id: string) => void }) {
  const confirmExit = useConfirmUnsavedExit();
  return (
    <>
      <button
        onClick={() => {
          if (confirmExit()) change('signed-out');
        }}
      >
        Cerrar sesión
      </button>
      <button onClick={() => change('user-b')}>Cambio externo de usuario</button>
    </>
  );
}
function Root() {
  const [user, setUser] = useState('user-a');
  const [renewals, setRenewals] = useState(0);
  return (
    <>
      <button onClick={() => setRenewals((n) => n + 1)}>Renovar sesión aislada</button>
      <output>{renewals}</output>
      <FormDraftProvider userId={user === 'signed-out' ? null : user} enabled>
        <UnsavedChangesProvider>
          <SessionActions change={setUser} />
          {user !== 'signed-out' && (
            <>
              <nav>
                <Link to="/purchases">Compras</Link> <Link to="/suppliers">Proveedores</Link>{' '}
                <Link to="/work">Trabajo</Link> <Link to="/other">Otro módulo</Link>
              </nav>
              <Outlet />
            </>
          )}
        </UnsavedChangesProvider>
      </FormDraftProvider>
    </>
  );
}
function Work() {
  const [value, setValue] = useState('');
  const [writes, setWrites] = useState(0);
  const [fail, setFail] = useState(false);
  const lock = useRef(false);
  const guard = useUnsavedValue(value);
  const navigate = useNavigate();
  async function save() {
    if (lock.current) return;
    lock.current = true;
    try {
      await Promise.resolve();
      if (fail) throw new Error('Simulated failure');
      setWrites((n) => n + 1);
      guard.markSaved(value);
    } catch {
      /* A failure deliberately leaves pending work dirty. */
    } finally {
      lock.current = false;
    }
  }
  return (
    <>
      <label>
        Trabajo pendiente
        <input value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button onClick={() => void save()}>Guardar aislado</button>
      <output aria-label="Escrituras">{writes}</output>
      <label>
        Fallar guardado
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
      </label>
      <button onClick={() => navigate('/other')}>Navegación programática</button>
    </>
  );
}
const router = createHashRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        path: 'schedule',
        element: (
          <EditorialScheduling
            item={{
              ...scheduleFixture,
              publication: { ...scheduleFixture.publication, status: 'APPROVED' },
            }}
            now={new Date('2026-10-20T12:00:00Z')}
            disabled={false}
            onSchedule={() => undefined}
          />
        ),
      },
      { path: 'purchases', element: <PurchasesPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'work', element: <Work /> },
      { path: 'other', element: <h1>Otro módulo</h1> },
    ],
  },
]);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
