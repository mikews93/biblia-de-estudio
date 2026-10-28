// Conexiones: todas las referencias cruzadas como arcos. Se elige un capítulo, se ven sus referencias más fuertes y se
// abre el pasaje; desde la barra del capítulo se llega con el libro y el capítulo ya elegidos.

import type { Locator } from '@playwright/test';

import { abrirHoja, expect, test } from './support/fixtures';

const visible = (l: Locator) => l.filter({ visible: true }).first();

test('de toda la Biblia a un capítulo y su pasaje', async ({ page }) => {
  await page.goto('/conexiones');
  await expect(visible(page.getByText('Toda la Biblia, conectada'))).toBeVisible();
  await expect(visible(page.getByText('286 602 conexiones', { exact: false }))).toBeVisible();
  await visible(page.getByRole('button', { name: /^Salmos 119/ })).click();
  await expect(page).toHaveURL(/libro=salmos&cap=119/);
  await expect(visible(page.getByText('LAS MÁS FUERTES'))).toBeVisible();
  await expect(visible(page.getByText(/^119:\d+$/))).toBeVisible();
  await visible(page.getByRole('button', { name: 'Leer Salmos 119' })).click();
  await expect(page).toHaveURL(/\/salmos\/119$/);
});

test('tocar la fila de libros elige un libro', async ({ page }) => {
  await page.goto('/conexiones');
  await expect(visible(page.getByText('Los capítulos más conectados'))).toBeVisible();
  const grafico = visible(page.getByLabel(/Arcos de las referencias cruzadas/));
  const caja = (await grafico.boundingBox())!;
  // Génesis empieza a la izquierda de la fila
  await page.mouse.click(caja.x + 3, caja.y + caja.height - 30);
  await expect(page).toHaveURL(/libro=genesis/);
  await expect(visible(page.getByText('CON QUIÉN CONVERSA MÁS'))).toBeVisible();
  await visible(page.getByLabel(/^Génesis 3: \d+ conexiones$/)).click();
  await expect(page).toHaveURL(/libro=genesis&cap=3/);
});

test('la barra del capítulo abre las conexiones de ese capítulo', async ({ page }) => {
  await page.goto('/juan/3');
  await abrirHoja(page, 'mas');
  await visible(page.getByText('Conexiones', { exact: true })).click();
  await expect(page).toHaveURL(/\/conexiones\?libro=juan&cap=3/);
  await expect(visible(page.getByText('Juan 3', { exact: true }))).toBeVisible();
});

test('promesa y cumplimiento enlaza con todas las referencias', async ({ page }) => {
  await page.goto('/promesas');
  await visible(page.getByText('Todas las referencias cruzadas')).click();
  await expect(page).toHaveURL(/\/conexiones$/);
});
