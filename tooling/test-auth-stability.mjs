/* Local isolated regression only. No Supabase session, credentials or remote writes. */
/* global window, performance */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import esbuild from 'esbuild';
import { createRequire } from 'node:module';
import { chromium, expect } from '@playwright/test';
const require = createRequire(import.meta.url);
const root = process.cwd(),
  mode = process.argv[2] || 'after';
async function main() {
  fs.mkdirSync('.external-image-edge-proof', { recursive: true });
  const build = await esbuild.build({
    entryPoints: ['apps/control-center/tests/auth-browser/fixture.tsx'],
    bundle: true,
    jsx: 'automatic',
    format: 'esm',
    platform: 'browser',
    write: false,
    alias: Object.fromEntries(
      ['react', 'react-dom', 'react-router-dom'].map((n) => [
        n,
        path.dirname(
          require.resolve(n + '/package.json', { paths: [root + '/apps/control-center'] }),
        ),
      ]),
    ),
    define: {
      'import.meta.env': JSON.stringify({
        DEV: false,
        PROD: true,
        BASE_URL: '/',
        VITE_AUTH_MODE: 'supabase',
        VITE_SUPABASE_URL: 'https://vnmkupzptujtywnnabkp.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture_only',
      }),
    },
    plugins: [
      {
        name: 'isolated-db',
        setup(b) {
          b.onResolve({ filter: /@lihen\/database$/ }, () => ({
            path: 'db',
            namespace: 'fixture',
          }));
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            resolveDir: root,
            contents:
              'export * from ' +
              JSON.stringify(root + '/packages/database/src/index.ts') +
              ';export const getBrowserSupabaseClient=()=>window.__fixtureClient;',
          }));
        },
      },
    ],
  });
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/app.js' ? 'text/javascript' : 'text/html');
    res.end(
      req.url === '/app.js'
        ? build.outputFiles[0].contents
        : '<div id="root"></div><script type="module" src="/app.js"></script>',
    );
  });
  await new Promise((r) => server.listen(4201, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true });
  const report = { mode, isolated: true, routes: [], checks: [] };
  try {
    const page = await browser.newPage();
    await page.route('**/*.supabase.co/**', (r) => r.abort());
    page.on('pageerror', (e) => report.checks.push('PAGE_ERROR:' + e.message));
    await page.goto('http://127.0.0.1:4201/');
    await expect(page.locator('input')).toBeVisible();
    const origin = await page.evaluate(() => performance.timeOrigin);
    report.initial = await page.evaluate(() => window.__authTest.snapshot());
    await page.locator('input').fill('UNSAVED');
    await page.evaluate(() => {
      window.__authTest.hold(true);
      window.__authTest.emit('TOKEN_REFRESHED');
    });
    await expect(page.getByText('Validando sesión y autorización…')).toBeVisible();
    report.pendingInputCount = await page.locator('input').count();
    await page.evaluate(() => window.__authTest.release());
    await expect(page.locator('input')).toBeVisible();
    report.valueAfterRefresh = await page.locator('input').inputValue();
    report.fullReload = (await page.evaluate(() => performance.timeOrigin)) !== origin;
    if (mode === 'before') {
      if (report.valueAfterRefresh !== '')
        throw Error('Expected baseline state loss not reproduced');
      report.checks.push('CONFIRMED_REACT_REMOUNT_AND_UNSAVED_STATE_LOSS_WITHOUT_DOCUMENT_RELOAD');
    } else {
      await expect(page.locator('input')).toHaveValue('UNSAVED');
      const routes = await page.evaluate(() => window.__authTest.routes);
      for (const route of routes) {
        await page.goto('http://127.0.0.1:4201/#' + route);
        await expect(page.getByTestId('route')).toHaveText(route);
        await page.locator('input').fill('DRAFT:' + route);
        const mounts = await page.evaluate((r) => window.__authTest.mounts[r], route);
        await page.evaluate(() => {
          window.__authTest.hold(true);
          for (let i = 0; i < 10; i++)
            window.__authTest.emit(i % 2 ? 'SIGNED_IN' : 'TOKEN_REFRESHED');
        });
        await expect(page.locator('input')).toHaveValue('DRAFT:' + route);
        await expect(page.locator('[inert]')).toHaveCount(1);
        await page.evaluate(() => window.__authTest.release());
        await expect(page.locator('[inert]')).toHaveCount(0);
        await expect(page.locator('input')).toHaveValue('DRAFT:' + route);
        if ((await page.evaluate((r) => window.__authTest.mounts[r], route)) !== mounts)
          throw Error('REMOUNT:' + route);
        report.routes.push({ route, result: 'PASS_AUTH_REFRESH_PROBE' });
      }
      await page.evaluate(() => {
        window.__authTest.hold(true);
        window.__authTest.emit('TOKEN_REFRESHED');
      });
      await expect(page.locator('[inert]')).toHaveCount(1);
      await page.evaluate(() =>
        window.__authTest.emit('SIGNED_IN', window.__authTest.newSession('fixture-other')),
      );
      await expect(page.locator('input')).toHaveCount(0);
      await page.evaluate(() => window.__authTest.release());
      await expect(page.getByTestId('user')).toHaveText('fixture-other');
      await expect(page.locator('input')).toHaveValue('');
      report.checks.push('IDENTITY_CHANGE_AND_STALE_AUTH_RESULT_ISOLATED');
      await page.clock.install();
      await page.evaluate(() => {
        window.__authTest.hold(true);
        window.__authTest.emit('TOKEN_REFRESHED');
      });
      await expect(page.locator('[inert]')).toHaveCount(1);
      await page.clock.fastForward(15001);
      await expect(page.getByRole('heading', { name: 'Acceso no autorizado' })).toBeVisible();
      await page.evaluate(() => window.__authTest.release());
      await expect(page.locator('input')).toHaveCount(0);
      report.checks.push('AUTHORIZATION_TIMEOUT_FAILS_CLOSED_WITHOUT_STALE_GRANT');
      await page.evaluate(() =>
        window.__authTest.emit('SIGNED_IN', window.__authTest.newSession('fixture-owner')),
      );
      await expect(page.locator('input')).toBeVisible();
      await page.evaluate(() => {
        window.__authTest.role('ERROR');
        window.__authTest.emit('USER_UPDATED');
      });
      await expect(page.getByRole('heading', { name: 'Acceso no autorizado' })).toBeVisible();
      report.checks.push('AUTHORIZATION_NETWORK_FAILURE_FAILS_CLOSED');
      await page.evaluate(() => {
        window.__authTest.role('ACTIVE');
        window.__authTest.emit('SIGNED_IN');
      });
      await expect(page.locator('input')).toBeVisible();
      await page.evaluate(() => {
        window.__authTest.role('INACTIVE');
        window.__authTest.emit('USER_UPDATED');
      });
      await expect(page.getByRole('heading', { name: 'Acceso no autorizado' })).toBeVisible();
      report.checks.push('REVOKED_PROFILE_DENIED');
      await page.evaluate(() => window.__authTest.emit('SIGNED_OUT', null));
      await expect(page.getByRole('heading', { name: 'LOGIN' })).toBeVisible();
      report.checks.push('SIGNED_OUT_DENIED');
      report.final = await page.evaluate(() => window.__authTest.snapshot());
      if (report.final.inCallbackReads !== 0 || report.final.subscribed !== 1)
        throw Error('Callback reads or duplicate subscriptions');
    }
    fs.writeFileSync(
      '.external-image-edge-proof/auth-stability-' + mode + '.json',
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
