export interface NavigationLink {
  readonly label: string;
  readonly href: string;
  readonly meta?: string;
}

export interface NavigationGroup {
  readonly title: string;
  readonly links: readonly NavigationLink[];
}

export interface MegaNavigationItem {
  readonly kind: 'mega';
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly groups: readonly NavigationGroup[];
  readonly accent: 'rose' | 'lilac' | 'gold';
}

export interface DirectNavigationItem {
  readonly kind: 'direct';
  readonly key: string;
  readonly label: string;
  readonly href: string;
}

export type StorefrontNavigationItem = MegaNavigationItem | DirectNavigationItem;

const beautyCategories: readonly NavigationLink[] = [
  { label: 'Cejas, pestañas y delineadores', href: '#beauty', meta: '26 referencias' },
  { label: 'Labiales, brillos e hidratantes', href: '#beauty', meta: '14 referencias' },
  { label: 'Bases, correctores, polvos y rubores', href: '#beauty', meta: '12 referencias' },
];

const beautyTools: readonly NavigationLink[] = [
  { label: 'Cepillos y accesorios para el cabello', href: '#accesorios', meta: '40 referencias' },
  { label: 'Accesorios para maquillaje', href: '#accesorios', meta: '18 referencias' },
];

/**
 * Curated storefront navigation.
 *
 * The Beauty Care category labels mirror the visible canonical taxonomy in DEV
 * after the Phase 5.2 cutover. Style remains a first-class LIHEN business line,
 * but no category labels are fabricated while the canonical projection has no
 * visible STYLE rows.
 */
export const storefrontNavigation: readonly StorefrontNavigationItem[] = [
  {
    kind: 'mega',
    key: 'novedades',
    label: 'Novedades',
    href: '#novedades',
    eyebrow: 'Descubre LIHEN.CO',
    title: 'Lo más reciente en un solo lugar',
    description: 'Explora la selección publicada de LIHEN y encuentra nuevas formas de acompañar tu rutina y tu estilo.',
    accent: 'gold',
    groups: [
      {
        title: 'Explora',
        links: [
          { label: 'Ver catálogo', href: '#beauty' },
          { label: 'Beauty Care', href: '#beauty' },
          { label: 'Accesorios', href: '#accesorios' },
        ],
      },
      {
        title: 'LIHEN',
        links: [
          { label: 'Así se vive LIHEN.CO', href: '#experiencia' },
          { label: 'Ideas para regalar', href: '#regalos' },
          { label: 'Nosotros', href: '#nosotros' },
        ],
      },
    ],
  },
  {
    kind: 'mega',
    key: 'beauty',
    label: 'Belleza',
    href: '#beauty',
    eyebrow: 'Beauty Care',
    title: 'Belleza para tu forma de cuidarte',
    description: 'Navegación basada en las categorías canónicas actualmente publicadas para Beauty Care.',
    accent: 'rose',
    groups: [
      { title: 'Maquillaje', links: beautyCategories },
      { title: 'Herramientas & accesorios', links: beautyTools },
    ],
  },
  {
    kind: 'mega',
    key: 'style',
    label: 'Moda',
    href: '#style',
    eyebrow: 'LIHEN Style',
    title: 'Tu estilo también vive aquí',
    description: 'La línea Style conserva su lugar en la experiencia LIHEN y se alimentará únicamente con referencias canónicas publicadas.',
    accent: 'lilac',
    groups: [
      {
        title: 'Explora Style',
        links: [
          { label: 'Colección Style', href: '#style' },
          { label: 'Novedades Style', href: '#style' },
        ],
      },
      {
        title: 'Compra informada',
        links: [
          { label: 'Consulta disponibilidad', href: '#style' },
          { label: 'Atención personalizada', href: '#experiencia' },
        ],
      },
    ],
  },
  {
    kind: 'mega',
    key: 'accessories',
    label: 'Accesorios',
    href: '#accesorios',
    eyebrow: 'Complementos LIHEN',
    title: 'Detalles prácticos para tu rutina',
    description: 'Accesos directos a las categorías de accesorios que ya existen en la taxonomía canónica publicada.',
    accent: 'gold',
    groups: [
      {
        title: 'Cabello',
        links: [{ label: 'Cepillos y accesorios', href: '#accesorios', meta: '40 referencias' }],
      },
      {
        title: 'Maquillaje',
        links: [{ label: 'Accesorios para maquillaje', href: '#accesorios', meta: '18 referencias' }],
      },
    ],
  },
  { kind: 'direct', key: 'experience', label: 'Así se vive LIHEN.CO', href: '#experiencia' },
  { kind: 'direct', key: 'gifts', label: 'Ideas para regalar', href: '#regalos' },
  { kind: 'direct', key: 'about', label: 'Nosotros', href: '#nosotros' },
];
