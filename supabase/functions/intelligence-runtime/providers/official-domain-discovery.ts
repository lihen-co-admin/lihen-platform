import type { EditorialAuthorityRecord } from '../../../../packages/intelligence-core/src/capabilities/editorial-research.ts';
import type {
  SearchPort,
  SearchProductIdentity,
  SearchResultItem,
} from '../../../../packages/intelligence-core/src/provider-ports.ts';
import { officialDiscoveryAuthorities } from './editorial-authority-registry.ts';

export interface OfficialDomainDiscoveryOptions {
  readonly allowedDomains: readonly string[];
  readonly authorities: readonly EditorialAuthorityRecord[];
  readonly fetchImpl?: typeof fetch;
}

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_000_000;
const MAX_SITEMAPS = 12;
const MAX_RESULTS = 8;
const MIN_SCORE = 20;
const stopwords = new Set(['con', 'de', 'del', 'la', 'el', 'las', 'los', 'y', 'para', 'por']);
const normalizedBrand = (value: string) =>
  value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
const tokens = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];

function sameHostHttps(raw: string, host: string): string | undefined {
  // Inspect the raw authority too: URL strips an explicit default :443 port.
  if (!/^https:\/\/[^\s/:@?#\\]+(?:[/?#]|$)/i.test(raw)) return undefined;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== host ||
      url.username ||
      url.password ||
      url.port
    )
      return undefined;
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
}

async function readDocument(uri: string, fetchImpl: typeof fetch): Promise<string | undefined> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(uri, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: { Accept: 'application/xml,text/xml,text/plain' },
        });
        if (!response.ok || response.redirected || (response.url && response.url !== uri))
          return undefined;
        if (Number(response.headers.get('content-length')) > MAX_BYTES) {
          void response.body?.cancel().catch(() => undefined);
          return undefined;
        }
        if (!response.body) return undefined;
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let size = 0;
        let text = '';
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) return text + decoder.decode();
          size += chunk.value.byteLength;
          if (size > MAX_BYTES) return undefined;
          text += decoder.decode(chunk.value, { stream: true });
        }
      })(),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          void reader?.cancel().catch(() => undefined);
          resolve(undefined);
        }, TIMEOUT_MS);
      }),
    ]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
    controller.abort();
    void reader?.cancel().catch(() => undefined);
  }
}

function xmlText(value: string): string | undefined {
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(value.trim());
  if (cdata) return cdata[1]?.trim();
  if (value.includes('<')) return undefined;
  return value
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
      const predefined: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
      };
      if (!entity.startsWith('#')) return predefined[entity] ?? '';
      const point = entity.startsWith('#x')
        ? parseInt(entity.slice(2), 16)
        : Number(entity.slice(1));
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    })
    .trim();
}

/** Restricted sitemap XML only; no DTD/entity expansion, HTML links or extension locs. */
function sitemapLocations(xml: string): { index: boolean; locations: string[] } | undefined {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return undefined;
  const clean = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*<\?xml[^?]*\?>/, '')
    .trim();
  const root = /^<(sitemapindex|urlset)(?:\s[^<>]*)?>([\s\S]*)<\/\1\s*>$/.exec(clean);
  if (!root) return undefined;
  const index = root[1] === 'sitemapindex';
  const entry = index
    ? /<sitemap(?:\s[^<>]*)?>([\s\S]*?)<\/sitemap\s*>/g
    : /<url(?:\s[^<>]*)?>([\s\S]*?)<\/url\s*>/g;
  const locations: string[] = [];
  for (const match of root[2]!.matchAll(entry)) {
    const loc = /^\s*<loc\s*>([\s\S]*?)<\/loc\s*>/.exec(match[1]!);
    const value = loc && xmlText(loc[1]!);
    if (value) locations.push(value);
  }
  return { index, locations };
}

function rank(uri: string, identity: SearchProductIdentity): SearchResultItem | undefined {
  const url = new URL(uri);
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return undefined;
  }
  if (/\.(?:xml|gz)$/i.test(path)) return undefined;
  const pathTokens = tokens(path);
  const sku = tokens(identity.sku ?? '').join('');
  // Whole token sequences avoid matching BC-067 against BC-0670 or XBC-067.
  const skuMatch =
    Boolean(sku) &&
    pathTokens.some((_, start) => {
      let candidate = '';
      for (const token of pathTokens.slice(start)) {
        candidate += token;
        if (candidate === sku) return true;
        if (candidate.length >= sku.length) break;
      }
      return false;
    });
  const nameTokens = [
    ...new Set(
      tokens(identity.productName).filter((token) => token.length > 2 && !stopwords.has(token)),
    ),
  ];
  const matchedTokens = nameTokens.filter((token) => pathTokens.includes(token));
  const productPath = /\/(?:product|products)\//i.test(path);
  const score = (skuMatch ? 100 : 0) + matchedTokens.length * 10 + (productPath ? 5 : 0);
  // A path bonus alone or one generic word cannot identify a candidate.
  if (
    score < MIN_SCORE ||
    (!skuMatch && (matchedTokens.length < 2 || matchedTokens.length / nameTokens.length < 0.6))
  )
    return undefined;
  const slug = path.split('/').filter(Boolean).pop() ?? url.hostname;
  return {
    title: slug.replace(/[-_]+/g, ' '),
    uri,
    sourceName: 'Official-domain sitemap discovery',
    metadata: { discovery: 'sitemap', score, skuMatch, matchedTokens, productPath },
  };
}

/** Returns candidates only. Retrieval, identity and authority checks remain downstream. */
export function createOfficialDomainDiscoveryPort(
  options: OfficialDomainDiscoveryOptions,
): SearchPort {
  const authorities = officialDiscoveryAuthorities(options.authorities, options.allowedDomains);
  return {
    descriptor: {
      toolId: 'official-domain-discovery',
      kind: 'SEARCH',
      name: 'Official-domain sitemap discovery',
      version: '1',
      description: 'Read-only product URL candidates from authorized same-host sitemaps.',
      readOnly: true,
    },
    async search(request) {
      const noResult = () => ({
        status: 'NO_RESULT' as const,
        data: [],
        messages: ['OFFICIAL_DOMAIN_DISCOVERY_NO_RESULT'],
      });
      const identity = request.expectedProductIdentity;
      if (!identity) return noResult();
      const domains = [
        ...new Set(
          authorities
            .filter((authority) =>
              identity.brandId?.trim()
                ? authority.brandId === identity.brandId.trim()
                : Boolean(identity.brand?.trim()) &&
                  normalizedBrand(authority.brand) === normalizedBrand(identity.brand!),
            )
            .map((authority) => authority.domain),
        ),
      ];
      if (!domains.length) return noResult();
      const fetchImpl = options.fetchImpl ?? fetch;
      const queue: { uri: string; host: string }[] = [];
      const queued = new Set<string>();
      const enqueue = (raw: string, host: string) => {
        const uri = sameHostHttps(raw, host);
        if (uri && !queued.has(uri) && queue.length < MAX_SITEMAPS) {
          queued.add(uri);
          queue.push({ uri, host });
        }
      };
      for (const host of domains) {
        const robots = await readDocument(`https://${host}/robots.txt`, fetchImpl);
        // Reserve the canonical candidate even if robots declares many maps.
        enqueue(`https://${host}/sitemap.xml`, host);
        for (const match of (robots ?? '').matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim))
          enqueue(match[1]!, host);
      }
      const candidates = new Map<string, SearchResultItem>();
      for (let i = 0; i < queue.length; i++) {
        const { uri, host } = queue[i]!;
        const xml = await readDocument(uri, fetchImpl);
        const sitemap = xml && sitemapLocations(xml);
        if (!sitemap) continue;
        for (const raw of sitemap.locations) {
          if (sitemap.index) {
            enqueue(raw, host);
            continue;
          }
          const page = sameHostHttps(raw, host);
          if (!page || queued.has(page)) continue;
          const item = rank(page, identity);
          if (item) candidates.set(page, item);
        }
      }
      const results = [...candidates.values()]
        .filter((item) => !queued.has(item.uri))
        .sort(
          (a, b) =>
            Number(b.metadata?.score) - Number(a.metadata?.score) || a.uri.localeCompare(b.uri),
        )
        .slice(0, MAX_RESULTS);
      return results.length ? { status: 'SUCCESS', data: results, messages: [] } : noResult();
    },
  };
}
