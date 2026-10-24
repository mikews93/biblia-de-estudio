// La fiesta de un sello nuevo (tarjeta y confeti) no debe mover la app: el confeti que sale por los lados o cae
// por debajo de la pantalla ensanchaba la página y en el Chrome de Android todo se veía alejado y descuadrado.

import { expect, test } from './support/fixtures';

test('ganar un sello celebra sin cambiar el tamaño de la página', async ({ page }) => {
  await page.goto('/');
  const medida = () => page.evaluate(() => [window.innerWidth, window.innerHeight, document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  await expect(page.getByText('Versículo del día', { exact: false }).first()).toBeVisible();
  const antes = await medida();

  await page.evaluate(() =>
    localStorage.setItem('sellos', JSON.stringify({ huellas: {}, ganados: { 'palabras-10': { fecha: '2026-10-23', visto: false } }, iniciado: true })),
  );
  await page.reload();
  await expect(page.getByTestId('celebracion')).toBeVisible();
  await expect(page.getByTestId('confeti')).toBeAttached();
  // A mitad de la lluvia de confeti, con papeles fuera de la pantalla
  await page.waitForTimeout(1200);
  expect(await medida()).toEqual(antes);
});
