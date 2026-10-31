// Direcciones que no existen (src/app/+not-found.tsx, src/components/NoEncontrada.tsx). Antes, un enlace copiado
// con el punto de la frase («zarzabiblia.com/instalar.») no abría nada.

import { expect, test } from './support/fixtures';

test('quita la puntuación pegada al enlace y abre la pantalla', async ({ page }) => {
  await page.goto('/instalar.');
  await expect(page).toHaveURL(/\/instalar$/);
  await page.goto('/juan/3/16%C2%BB');
  await expect(page).toHaveURL(/\/juan\/3\/16$/);
});

test('una dirección inexistente muestra la página y propone la más parecida', async ({ page }) => {
  await page.goto('/instala');
  await expect(page.getByTestId('no-encontrada')).toBeVisible();
  await expect(page.getByText('Esta página no existe')).toBeVisible();
  await page.getByTestId('no-encontrada-sugerencia').click();
  await expect(page).toHaveURL(/\/instalar$/);
});

test('un libro mal escrito o un capítulo de más propone el pasaje', async ({ page }) => {
  await page.goto('/jaun/3/16');
  await expect(page.getByTestId('no-encontrada-sugerencia')).toContainText('Juan 3:16');
  await page.goto('/juan/30');
  await expect(page.getByTestId('no-encontrada-sugerencia')).toContainText('Juan 21');
  await page.goto('/algo-que-no-existe');
  await expect(page.getByTestId('no-encontrada')).toBeVisible();
  await expect(page.getByTestId('no-encontrada-sugerencia')).toHaveCount(0);
});
