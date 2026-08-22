import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const SUPABASE_URL = 'https://admhxolrhhipwcxbythl.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_lBc4zpIyG9PE58hXV0iYfA_8NUBKY4Z';
const EMAIL = process.env.LIHEN_LEGACY_ADMIN_EMAIL;
const PASSWORD = process.env.LIHEN_LEGACY_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Missing LIHEN_LEGACY_ADMIN_EMAIL or LIHEN_LEGACY_ADMIN_PASSWORD.');
  process.exit(2);
}

const tables = [
  'products',
  'inventory',
  'inventory_movements',
  'quick_sales',
  'quick_sale_items',
  'orders',
  'order_items',
  'financial_accounts',
  'financial_movements',
  'suppliers',
  'supplier_products',
  'supplier_requests',
  'supplier_request_items',
  'supplier_payments',
  'product_cost_history',
];

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.resolve(process.cwd(), `legacy-export-${stamp}`);
await fs.mkdir(outputDir, { recursive: true });

async function authenticate() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Authentication failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error('Authentication response did not contain access_token.');
  return data.access_token;
}

async function exportTable(table, token) {
  const rows = [];
  const pageSize = 500;
  let offset = 0;
  while (true) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        Range: `${offset}-${offset + pageSize - 1}`,
        Prefer: 'count=exact',
      },
    });
    const text = await response.text();
    if (!response.ok) {
      return { status: 'UNAVAILABLE', http_status: response.status, detail: text.slice(0, 500), rows: [] };
    }
    const batch = JSON.parse(text);
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return { status: 'EXPORTED', rows };
}

let token;
try {
  token = await authenticate();
  console.log('Authenticated against legacy LIHEN Admin Supabase.');
} catch (error) {
  console.error(String(error.message || error));
  process.exit(3);
}

const manifest = {
  export_version: 'LIHEN_LEGACY_READONLY_EXPORT_V1',
  source_project_ref: 'admhxolrhhipwcxbythl',
  source_url: SUPABASE_URL,
  generated_at: new Date().toISOString(),
  read_only: true,
  tables: {},
};

for (const table of tables) {
  process.stdout.write(`Exporting ${table}... `);
  const result = await exportTable(table, token);
  if (result.status !== 'EXPORTED') {
    manifest.tables[table] = {
      status: result.status,
      http_status: result.http_status,
      detail: result.detail,
    };
    console.log(`${result.status} (${result.http_status})`);
    continue;
  }
  const payload = Buffer.from(JSON.stringify(result.rows, null, 2) + '\n', 'utf8');
  const file = `${table}.json`;
  await fs.writeFile(path.join(outputDir, file), payload);
  manifest.tables[table] = {
    status: 'EXPORTED',
    row_count: result.rows.length,
    file,
    sha256: sha256(payload),
    bytes: payload.length,
  };
  console.log(`${result.rows.length} rows`);
}

const manifestPayload = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');
await fs.writeFile(path.join(outputDir, 'manifest.json'), manifestPayload);
await fs.writeFile(path.join(outputDir, 'README.txt'),
`LIHEN legacy Admin read-only export\nSource: admhxolrhhipwcxbythl\nGenerated: ${manifest.generated_at}\n\nThis directory may contain operational and financial business data. Do NOT commit it to GitHub. Share it only through the current ChatGPT conversation for Phase 1.28 reconciliation.\n`, 'utf8');

console.log('\n==============================================');
console.log('LEGACY READ-ONLY EXPORT COMPLETE');
console.log(`Output: ${outputDir}`);
console.log(`Manifest SHA-256: ${sha256(manifestPayload)}`);
console.log('No write/update/delete requests were executed.');
console.log('Do NOT git add this export directory.');
console.log('==============================================');
