export const CONTROL_CENTER_MODULES = [
  ['/', 'Inicio', 'home'],
  ['/products', 'Productos', 'bag'],
  ['/brands', 'Marcas', 'star'],
  ['/categories', 'Categorías', 'grid'],
  ['/catalogs', 'Catálogos', 'book'],
  ['/inventory', 'Inventario', 'box'],
  ['/suppliers', 'Proveedores', 'truck'],
  ['/purchases', 'Compras', 'cart'],
  ['/orders', 'Pedidos', 'list'],
  ['/customers/benefits', 'Clientes / Bonos', 'users'],
  ['/sales', 'Ventas / POS', 'card'],
  ['/finance', 'Caja y finanzas', 'chart'],
  ['/content/public-hub', 'Hub público', 'globe'],
  ['/content/social', 'Contenido y calendario', 'calendar'],
  ['/conversations', 'Conversaciones / WhatsApp', 'chat'],
  ['/cloud', 'Workspace', 'cloud'],
  ['/assistant', 'Intelligence Assistant', 'spark'],
  ['/operations', 'Integridad y auditoría', 'shield'],
] as const;

export type VisualGroup =
  'catalog' | 'operations' | 'administration' | 'editorial' | 'intelligence';
export const THEMED_GROUPS: readonly VisualGroup[] = [
  'catalog',
  'operations',
  'administration',
  'editorial',
  'intelligence',
];
export function visualGroup(pathname: string): VisualGroup {
  const root = pathname.split('/')[1];
  if (['inventory', 'suppliers', 'purchases', 'orders', 'sales'].includes(root ?? ''))
    return 'operations';
  if (root === 'finance' || root === 'customers') return 'administration';
  if (root === 'content' || root === 'conversations' || root === 'dev-whatsapp-preflight')
    return 'editorial';
  if (
    root === 'cloud' ||
    root === 'assistant' ||
    root === 'operations' ||
    root === 'dev-auth-probe'
  )
    return 'intelligence';
  return 'catalog';
}
