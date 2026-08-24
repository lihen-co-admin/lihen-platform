import './styles/global.css';
import './styles/shell.css';
import { bindSiteShellInteractions, renderSiteShell } from './components/site-shell';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Storefront root not found.');

app.innerHTML = renderSiteShell();
bindSiteShellInteractions(app);
