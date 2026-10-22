// Promesa y cumplimiento: el arco de las promesas, un hilo paso a paso con el texto de cada pasaje, y el aviso
// en el lector cuando un versículo es parte de un hilo.

import type { Locator } from '@playwright/test';

import { expect, test } from './support/fixtures';

const visible = (l: Locator) => l.filter({ visible: true });

test('de la lista de promesas a un hilo, con su promesa y su cumplimiento', async ({ page }) => {
  await page.goto('/promesas');
  await expect(visible(page.getByText('Todas las promesas de Dios son en él Sí')).first()).toBeVisible();
  await visible(page.getByText('Nacido de una virgen')).first().click();
  await expect(page).toHaveURL(/\/promesas\/virgen$/);
  await expect(visible(page.getByText('LA PROMESA')).first()).toBeVisible();
  await expect(visible(page.getByText(/la virgen concebirá, y parirá hijo/)).first()).toBeVisible();
  await expect(visible(page.getByText('SE CUMPLE')).first()).toBeVisible();
  await visible(page.getByText('Leer en contexto')).first().click();
  await expect(page).toHaveURL(/\/isaias\/7\/14$/);
});

test('el versículo de una promesa la ofrece en sus acciones', async ({ page }) => {
  await page.goto('/isaias/7/14');
  await visible(page.getByText('Promesa', { exact: true })).first().click();
  await expect(page).toHaveURL(/\/promesas\/virgen$/);
});
