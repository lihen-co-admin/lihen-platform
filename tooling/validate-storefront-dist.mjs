import { promises as fs } from 'node:fs';
import path from 'node:path';

const dist = path.resolve('apps/storefront/dist');
const required = ['index.html'];
for (const file of required) {
  await fs.access(path.join(dist, file));
}

const forbidden = [/service[_-]?role/i, /products\.js/i, /catalog_public/i, /data\/catalog-v1/i, /LIHEN_DEV_AUTH_PASSWORD/i];
const textExtensions = new Set(['.html', '.js', '.css', '.json', '.map']);
const violations = [];

async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name))) continue;
    const content = await fs.readFile(fullPath, 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(content)) violations.push(`${path.relative(dist, fullPath)} matches ${pattern}`);
    }
  }
}

await walk(dist);
if (violations.length > 0) {
  console.error('Storefront dist integrity: FAIL');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}
console.log('Storefront dist integrity: PASS');
