// «Hombres de pie»: sin cuenta, abrir la primera semana, leer el pasaje, responder a solas, cumplir el reto y
// terminarla para que se abra la segunda. Las respuestas siguen ahí al volver.
import { expect, test } from './support/fixtures';

test('hacer la primera semana de «Hombres de pie» y pasar a la segunda', async ({ page }) => {
  await page.goto('/hombres');
  await expect(page.getByText('0 DE 8 SEMANAS').filter({ visible: true })).toBeVisible();
  // La segunda semana todavía no se abre
  await expect(page.getByRole('link', { name: /Hierro con hierro/ }).filter({ visible: true })).toBeDisabled();
  await page.getByRole('link', { name: /Esfuérzate y sé valiente/ }).filter({ visible: true }).click();

  await expect(page.getByText('HOMBRES DE PIE · SEMANA 1 DE 8').filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/Mira que te mando que te esfuerces/).filter({ visible: true })).toBeVisible();
  await page.getByLabel('Pregunta 1').filter({ visible: true }).fill('En hablar de mi fe en el trabajo.');
  await page.getByRole('checkbox', { name: 'Cumplí el reto' }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Terminé esta semana' }).filter({ visible: true }).click();
  await expect(page.getByText(/Terminaste esta semana el/).filter({ visible: true })).toBeVisible();

  await page.getByRole('button', { name: 'Ir a la semana 2' }).filter({ visible: true }).click();
  await expect(page.getByText('HOMBRES DE PIE · SEMANA 2 DE 8').filter({ visible: true })).toBeVisible();

  await page.goto('/hombres');
  await expect(page.getByText('1 DE 8 SEMANAS').filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/reto cumplido/).filter({ visible: true })).toBeVisible();
  await page.getByRole('link', { name: /Esfuérzate y sé valiente/ }).filter({ visible: true }).click();
  await expect(page.getByLabel('Pregunta 1').filter({ visible: true })).toHaveValue('En hablar de mi fe en el trabajo.');
});
