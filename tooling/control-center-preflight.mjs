import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configurationReadiness } from '../apps/control-center/src/domain/configuration-readiness.ts';

const app = new URL('../apps/control-center/', import.meta.url);
const require = createRequire(new URL('package.json', app));
const { loadEnv } = await import(pathToFileURL(require.resolve('vite')).href);
const env = loadEnv('development', fileURLToPath(app), 'VITE_');
console.log(JSON.stringify(configurationReadiness({ ...env, DEV: true }), null, 2));
console.log('Configuration only; no network requests. READY requires browser/RPC verification.');
