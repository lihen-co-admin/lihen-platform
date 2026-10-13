import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './app/App';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/auth-context';
import { FormDraftProvider, devFormDraftsEnabled } from './drafts/FormDraftProvider';
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
      <App />
    </FormDraftProvider>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found.');

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <DraftAwareApp />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
