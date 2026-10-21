import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
test.setTimeout(60000);
const before = process.env.LAYOUT_CAPTURE === 'before';
const stage = before ? 'before' : 'after';
for (const [width, height] of [
  [1440, 1000],
  [1440, 768],
  [1280, 540],
  [768, 1024],
  [390, 844],
  [844, 390],
]) {
  test(`${stage} ${width}x${height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/*', (route) =>
      new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort(),
    );
    await page.setViewportSize({ width: width!, height: height! });
    const evidence = [];
    for (const route of ['/', '/brands', '/products/lab', '/operations']) {
      await page.goto('/#' + route);
      await expect(page.locator('.cc-module')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.pm2-rail nav a')).toHaveCount(18);
      await page
        .locator('.cc-module')
        .getByText('Cargando', { exact: false })
        .first()
        .waitFor({ state: 'hidden', timeout: 15000 })
        .catch(() => {});
      await page.screenshot({
        path: `artifacts/layout-fix/${stage}-${width}x${height}-${route.replaceAll('/', '_') || 'dashboard'}.png`,
      });
      const metrics = await page.evaluate(() => {
        const rail = document.querySelector('.pm2-rail')!,
          nav = rail.querySelector('nav')!;
        return {
          railHeight: rail.clientHeight,
          railScroll: rail.scrollHeight,
          navHeight: nav.clientHeight,
          navScroll: nav.scrollHeight,
          overflow: getComputedStyle(nav).overflowY,
          pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          positions: [...nav.querySelectorAll('a')].map((a) => {
            const r = a.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          }),
        };
      });
      evidence.push({ route, ...metrics });
      if (!before) {
        expect(metrics.overflow).toBe('visible');
        expect(metrics.navScroll).toBeLessThanOrEqual(metrics.navHeight + 1);
        expect(metrics.pageOverflow).toBe(false);
        for (const p of metrics.positions) {
          expect(p.w).toBeGreaterThanOrEqual(36);
          expect(p.h).toBeGreaterThanOrEqual(36);
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.x + p.w).toBeLessThanOrEqual(width! + 1);
          if (width! > 900 && height! > 600) expect(p.y + p.h).toBeLessThanOrEqual(height!);
        }
      }
    }
    if (!before) {
      const links = page.locator('.pm2-rail nav a');
      await links.first().focus();
      for (let i = 0; i < 18; i++) {
        await expect(links.nth(i)).toBeFocused();
        await page.keyboard.press('Tab');
      }
      await page.getByRole('button', { name: /^Expandir/ }).click();
      for (let i = 0; i < 18; i++) await expect(links.nth(i).locator('span')).toBeVisible();
      const expanded = await page.locator('.pm2-rail nav').evaluate((nav) => ({
        overflow: getComputedStyle(nav).overflowY,
        height: nav.clientHeight,
        scroll: nav.scrollHeight,
        bottom: nav.getBoundingClientRect().bottom,
        pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      expect(expanded.overflow).toBe('visible');
      expect(expanded.scroll).toBeLessThanOrEqual(expanded.height + 1);
      expect(expanded.pageOverflow).toBe(false);
      if (width! > 900 && height! > 600) expect(expanded.bottom).toBeLessThanOrEqual(height!);
      await page.screenshot({ path: `artifacts/layout-fix/after-${width}x${height}-expanded.png` });
      await expect(page.locator('.pm2-rail-foot')).toHaveText('DEV');
      await expect(page.locator('.pm2-rail a.is-current')).toHaveCount(1);
      expect(errors).toEqual([]);
    }
    mkdirSync('artifacts/layout-fix', { recursive: true });
    writeFileSync(
      `artifacts/layout-fix/${stage}-${width}x${height}.json`,
      JSON.stringify(evidence, null, 2),
    );
  });
}
