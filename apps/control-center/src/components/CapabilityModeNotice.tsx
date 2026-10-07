import { configurationReadiness } from '../domain/configuration-readiness';

const routes: Record<string, readonly string[]> = {
  products: ['PRODUCT', 'PRODUCT_UPDATE', 'PRICE', 'PRICE_HISTORY', 'PRODUCT_IMAGES', 'PRODUCT_IMAGE_WRITE'],
  inventory: ['INVENTORY'], suppliers: ['SUPPLIERS'], purchases: ['PURCHASES'], orders: ['ORDERS'], sales: ['SALES'], finance: ['FINANCE'],
};
export function CapabilityModeNotice({ pathname, env }: { pathname: string; env: Record<string, unknown> }) {
  const capabilities = routes[pathname.split('/')[1] ?? ''];
  if (!capabilities) return null;
  const configuration = configurationReadiness(env);
  return <aside className="info-state" aria-label="Modos de la capacidad">
    <strong>{configuration.source === 'memory' ? 'SIMULACIÓN EN MEMORIA · cambios no durables' : 'SUPABASE · modos configurados'}</strong>
    <p>{configuration.capabilities.filter(row => capabilities.includes(row.capability)).map(row => `${row.capability}: ${row.mode} (${row.status})`).join(' · ')}</p>
    <small>Los modos controlled requieren autorización y RPC disponibles. Este estado no confirma conectividad ni operaciones ejecutadas.</small>
  </aside>;
}
