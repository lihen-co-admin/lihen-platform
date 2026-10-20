import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider, HashRouter } from 'react-router-dom';
import { App } from './app/App';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/auth-context';
import { FormDraftProvider, devFormDraftsEnabled } from './drafts/FormDraftProvider';
import { UnsavedChangesProvider } from './drafts/UnsavedChanges';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/app.css';

function DraftAwareApp() {
  const auth = useAuth();
  return (
    <FormDraftProvider
      userId={auth.user?.id ?? null}
      enabled={devFormDraftsEnabled(import.meta.env)}
    >
      {devFormDraftsEnabled(import.meta.env) ? (
        <UnsavedChangesProvider>
          <App />
        </UnsavedChangesProvider>
      ) : (
        <App />
      )}
    </FormDraftProvider>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found.');

const devRouter = devFormDraftsEnabled(import.meta.env)
  ? createHashRouter([
      {
        path: '*',
        element: (
          <AuthProvider>
            <DraftAwareApp />
          </AuthProvider>
        ),
      },
    ])
  : null;

createRoot(root).render(
  <StrictMode>
    {devRouter ? (
      <RouterProvider router={devRouter} />
    ) : (
      <HashRouter>
        <AuthProvider>
          <DraftAwareApp />
        </AuthProvider>
      </HashRouter>
    )}
  </StrictMode>,
);
