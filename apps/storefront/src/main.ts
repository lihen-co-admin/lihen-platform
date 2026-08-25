import './styles/global.css';
import './styles/navigation.css';
import './styles/home.css';
import './styles/products.css';
import './styles/static-content.css';
import './styles/shell.css';
import { bindSiteShellInteractions, renderSiteShell } from './components/site-shell';
import { renderCurrentRoute } from './components/storefront-router';
import { configureStorefrontSeo } from './components/storefront-seo';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Storefront root not found.');

configureStorefrontSeo();
app.innerHTML = renderSiteShell();
bindSiteShellInteractions(app);
void renderCurrentRoute(app);
