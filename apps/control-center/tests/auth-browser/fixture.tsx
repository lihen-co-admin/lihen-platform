// Isolated test identity only: no browser credentials or remote session are used.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider, Routes, Route, useLocation } from 'react-router-dom';
import { FormDraftProvider } from '../../src/drafts/FormDraftProvider';
import { UnsavedChangesProvider, useUnsavedChanges } from '../../src/drafts/UnsavedChanges';
import { AuthProvider } from '../../src/auth/AuthProvider';
import { ProtectedRoute } from '../../src/auth/ProtectedRoute';
import { useAuth } from '../../src/auth/auth-context';
const routes = [
  '/',
  '/products',
  '/brands',
  '/categories',
  '/catalogs',
  '/inventory',
  '/suppliers',
  '/purchases',
  '/orders',
  '/customers/benefits',
  '/sales',
  '/finance',
  '/content/public-hub',
  '/content/social',
  '/conversations',
  '/cloud',
  '/assistant',
  '/operations',
];
let callback,
  subscribed = 0,
  reads = 0,
  inCallbackReads = 0,
  inside = false,
  hold = false,
  role = 'ACTIVE',
  pending = [];
let session = { user: { id: 'fixture-owner' }, access_token: 'ISOLATED_FIXTURE_NOT_A_TOKEN' };
function read(table, id, signal) {
  reads++;
  if (inside) inCallbackReads++;
  const status = role;
  return new Promise((resolve, reject) => {
    const finish = () =>
      status === 'ERROR'
        ? resolve({ data: null, error: { message: 'ISOLATED_NETWORK_FAILURE' } })
        : resolve({
            data:
              table === 'profiles'
                ? {
                    id: id || session?.user.id,
                    role_code: 'OWNER',
                    authorization_status: status,
                    email: null,
                    display_name: 'Fixture',
                  }
                : [{ code: 'OWNER' }, { code: 'ADMIN' }],
            error: null,
          });
    if (signal) {
      signal.addEventListener('abort', () => reject(new Error('ABORTED')), { once: true });
    }
    if (hold) pending.push(finish);
    else setTimeout(finish, 20);
  });
}
window.__fixtureClient = {
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: (fn) => {
      callback = fn;
      subscribed++;
      let active = true;
      queueMicrotask(() => {
        if (active) {
          inside = true;
          fn('INITIAL_SESSION', session);
          inside = false;
        }
      });
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              active = false;
              subscribed--;
            },
          },
        },
      };
    },
    signOut: async () => {
      window.__authTest.emit('SIGNED_OUT', null);
      return { error: null };
    },
  },
  from: (table) => {
    let id, signal;
    const q = {
      select: () => q,
      eq: (_k, v) => {
        id = v;
        return q;
      },
      abortSignal: (s) => {
        signal = s;
        return q;
      },
      maybeSingle: () => read(table, id, signal),
      returns: () => read(table, id, signal),
    };
    return q;
  },
};
window.__authTest = {
  routes,
  mounts: {},
  unmounts: {},
  emit: (event, next = session) => {
    session = next;
    inside = true;
    callback(event, next);
    inside = false;
  },
  hold: (value) => {
    hold = value;
  },
  release: () => {
    hold = false;
    const tasks = pending;
    pending = [];
    tasks.forEach((f) => f());
  },
  role: (value) => {
    role = value;
  },
  snapshot: () => ({ reads, inCallbackReads, subscribed, pending: pending.length }),
  newSession: (id) => ({ user: { id }, access_token: 'ISOLATED_FIXTURE_NOT_A_TOKEN' }),
};
function Probe() {
  const { pathname } = useLocation(),
    auth = useAuth();
  const [value, setValue] = useState('');
  useUnsavedChanges(Boolean(value));
  useEffect(() => {
    window.__authTest.mounts[pathname] = (window.__authTest.mounts[pathname] || 0) + 1;
    return () => {
      window.__authTest.unmounts[pathname] = (window.__authTest.unmounts[pathname] || 0) + 1;
    };
  }, []);
  return (
    <main>
      <h1 data-testid="route">{pathname}</h1>
      <p data-testid="user">{auth.user?.id}</p>
      <input aria-label="Unsaved probe" value={value} onChange={(e) => setValue(e.target.value)} />
    </main>
  );
}
function DraftAwareRoutes() {
  const auth = useAuth();
  return (
    <FormDraftProvider userId={auth.user?.id ?? null} enabled>
      <UnsavedChangesProvider>
        <Routes>
          <Route path="/login" element={<h1>LOGIN</h1>} />
          <Route element={<ProtectedRoute />}>
            {routes.map((p) => (
              <Route key={p} path={p} element={<Probe key={p} />} />
            ))}
          </Route>
        </Routes>
      </UnsavedChangesProvider>
    </FormDraftProvider>
  );
}
const router = createHashRouter([
  {
    path: '*',
    element: (
      <AuthProvider>
        <DraftAwareRoutes />
      </AuthProvider>
    ),
  },
]);
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
