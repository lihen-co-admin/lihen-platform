import { expect, test } from '@playwright/test';

const email = process.env.LIHEN_DEV_AUTH_EMAIL;
const password = process.env.LIHEN_DEV_AUTH_PASSWORD;

test('real DEV JWT can read products through RLS', async ({ page }) => {
  test.skip(!email || !password, 'Requires LIHEN_DEV_AUTH_EMAIL and LIHEN_DEV_AUTH_PASSWORD.');

  await page.goto('/login');
  await page.getByLabel('Correo').fill(email!);
  await page.getByLabel('Contraseña').fill(password!);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();
  await expect(page.getByText(/Fuente: Supabase DEV/i)).toBeVisible();
});
