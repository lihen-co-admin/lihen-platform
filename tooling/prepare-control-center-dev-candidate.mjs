import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const app = join(root, 'apps/control-center');
const require = createRequire(join(app, 'package.json'));
const { build, loadEnv } = await import(pathToFileURL(require.resolve('vite')).href);
const env = {
  ...loadEnv('development', app, 'VITE_'),
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([name, value]) => name.startsWith('VITE_') && value !== undefined,
    ),
  ),
};
if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_URL !== 'https://vnmkupzptujtywnnabkp.supabase.co')
  throw new Error('BUILD_NON_DEV_TARGET_BLOCKED');
if (
  Object.entries(env).some(
    ([name, value]) => value && /SECRET|PASSWORD|SERVICE_ROLE|GROQ|GEMINI|ACCESS_TOKEN/i.test(name),
  )
)
  throw new Error('BUILD_BROWSER_SECRET_VARIABLE_BLOCKED');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
if (key && !key.startsWith('sb_publishable_')) {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
  } catch {
    throw new Error('BUILD_PUBLIC_KEY_INVALID');
  }
  if (payload.role !== 'anon' || payload.ref !== 'vnmkupzptujtywnnabkp')
    throw new Error('BUILD_PUBLIC_KEY_NOT_DEV_ANON');
}
const configured =
  env.VITE_PRODUCT_READ_SOURCE === 'supabase' &&
  env.VITE_AUTH_MODE === 'supabase' &&
  env.VITE_SUPABASE_URL === 'https://vnmkupzptujtywnnabkp.supabase.co' &&
  Boolean(key);
env.VITE_PRODUCT_PILOT_MODE = 'controlled';
env.VITE_CUSTOMER_BENEFIT_DEMO_ENABLED = 'false';
if (configured) env.VITE_LOCAL_FORM_DRAFTS_MODE = 'controlled';
const output = resolve(
  root,
  'dist',
  `center-2-dev-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);
await mkdir(output, { recursive: true });
await build({
  logLevel: 'warn',
  root: app,
  configFile: join(app, 'vite.config.ts'),
  mode: 'development',
  base: '/lihen-platform/control-center/',
  define: Object.fromEntries(
    Object.entries(env).map(([name, value]) => [`import.meta.env.${name}`, JSON.stringify(value)]),
  ),
  build: { outDir: join(output, 'control-center'), emptyOutDir: false, sourcemap: false },
});
async function inventory(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name),
      name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...(await inventory(path, name + '/')));
    else {
      const data = await readFile(path);
      result.push({
        path: name,
        bytes: data.length,
        sha256: createHash('sha256').update(data).digest('hex'),
      });
    }
  }
  return result;
}
const manifest = {
  stage: 'LOCAL_CANDIDATE',
  build: 'PASS',
  configured,
  remoteSessionVerified: false,
  pilotScope: 'BC-20550/ST-019',
  base: '/lihen-platform/control-center/',
  deployAuthorized: false,
  externalPublicationAuthorized: false,
  blockers: configured
    ? ['AUTH_RLS_RUNTIME_NOT_VERIFIED', 'DEPLOYMENT_NOT_AUTHORIZED']
    : [
        'DEV_BROWSER_CONFIGURATION_MISSING',
        'AUTH_RLS_RUNTIME_NOT_VERIFIED',
        'DEPLOYMENT_NOT_AUTHORIZED',
      ],
  files: await inventory(join(output, 'control-center')),
};
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(
  JSON.stringify({
    build: 'PASS',
    configured,
    deployAuthorized: false,
    artifact: output,
    files: manifest.files.length,
    blockers: manifest.blockers,
  }),
);
