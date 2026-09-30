import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '../../src/auth/auth-context';
import { SocialContentPage } from '../../src/pages/SocialContentPage';
import '../../src/styles/reset.css';
import '../../src/styles/tokens.css';
import '../../src/styles/app.css';

// Only the session and read ports are doubled; the page, handler and composer are real.
const auth = {
  enabled: true,
  authorized: true,
  user: { id: 'local-owner' },
  profile: { roleCode: 'OWNER' },
} as AuthContextValue;
createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <AuthContext.Provider value={auth}>
      <SocialContentPage />
    </AuthContext.Provider>
  </MemoryRouter>,
);
