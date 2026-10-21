import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export function validatePages(root) {
  for (const site of ['control-center', 'storefront']) {
    const base = join(root, site);
    if (!existsSync(join(base, 'index.html'))) throw Error('SITE_INDEX_MISSING');
    const html = readFileSync(join(base, 'index.html'), 'utf8');
    for (const [, ref] of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
      if (/^(https?:|data:)/.test(ref)) continue;
      const file = ref.startsWith('/lihen-platform/')
        ? join(root, ref.slice('/lihen-platform/'.length))
        : resolve(base, ref);
      if (!file.startsWith(resolve(root)) || !existsSync(file))
        throw Error('ENTRY_RESOURCE_MISSING');
    }
  }
  let files = 0;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isSymbolicLink()) throw Error('ARTIFACT_SYMLINK_BLOCKED');
      if (e.isDirectory()) walk(p);
      else {
        files++;
        if (/\.map$|\.env|product-master-(snapshot|pilots|official-family)\.json/.test(e.name))
          throw Error('PRIVATE_ARTIFACT_FILE');
        if (/\.(js|html|css)$/.test(e.name)) {
          const text = readFileSync(p, 'utf8');
          if (
            text.includes('gqitoossdbiohqegjvlh.supabase.co') ||
            /sb_secret_[A-Za-z0-9_-]{15,}|gsk_[A-Za-z0-9]{25,}/.test(text)
          )
            throw Error('UNSAFE_BROWSER_DESTINATION_OR_SECRET');
          for (const token of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ??
            []) {
            let data;
            try {
              data = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
            } catch {
              continue;
            }
            if (data.role === 'service_role') throw Error('BROWSER_SERVICE_ROLE_BLOCKED');
          }
        }
      }
    }
  };
  walk(root);
  return { status: 'PASS', files };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(validatePages(resolve(process.argv[2]))));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
