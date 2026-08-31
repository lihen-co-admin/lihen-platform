export type StyleCategoryCoverKey =
  | 'ENTERIZOS'
  | 'FALDA_TOP'
  | 'SHORTS'
  | 'HOMBRE'
  | 'GENERIC';

export type StyleCategoryCoverDescriptor = {
  key: StyleCategoryCoverKey;
  label: string;
  aliases: readonly string[];
};

export const STYLE_CATEGORY_COVERS: readonly StyleCategoryCoverDescriptor[] = [
  {
    key: 'ENTERIZOS',
    label: 'Enterizos deportivos',
    aliases: ['enterizo', 'enterizos', 'enterizos deportivos'],
  },
  {
    key: 'FALDA_TOP',
    label: 'Conjuntos deportivos / Falda + Top',
    aliases: ['falda + top', 'falda-top', 'falda short', 'falda-short', 'conjunto falda', 'conjuntos falda'],
  },
  {
    key: 'SHORTS',
    label: 'Shorts deportivos',
    aliases: ['short', 'shorts', 'short deportivo', 'shorts deportivos'],
  },
  {
    key: 'HOMBRE',
    label: 'Hombre',
    aliases: ['hombre', 'caballero', 'masculino', 'conjunto hombre', 'conjuntos hombre'],
  },
] as const;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveStyleCategoryCoverKey(value: string): StyleCategoryCoverKey {
  const normalized = normalizeText(value);

  for (const cover of STYLE_CATEGORY_COVERS) {
    if (cover.aliases.some((alias) => normalized.includes(normalizeText(alias)))) {
      return cover.key;
    }
  }

  return 'GENERIC';
}

export function resolveStyleCategoryLabel(value: string): string {
  const key = resolveStyleCategoryCoverKey(value);
  const descriptor = STYLE_CATEGORY_COVERS.find((item) => item.key === key);
  return (descriptor?.label ?? value.trim()) || 'LIHEN Style';
}
