import { expect, test } from './support/fixtures';

// «Lectura tranquila»: sin rachas, insignias ni barras de avance; lo guardado sigue igual.
test('la lectura tranquila quita rachas, insignias y barras de avance', async ({ page }) => {
  await page.goto('/diario');
  const insignias = page.getByText('INSIGNIAS DE LA RACHA');
  await expect(insignias).toBeVisible();
  await expect(page.getByText('INSIGNIAS DE SERVICIO')).toBeVisible();

  await page.getByRole('switch', { name: 'Lectura tranquila' }).click();
  await expect(page.getByText('Sin rachas, insignias ni porcentajes.', { exact: false })).toBeVisible();
  await expect(insignias).toHaveCount(0);
  await expect(page.getByText('INSIGNIAS DE SERVICIO')).toHaveCount(0);

  // Se recuerda al volver
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Lectura tranquila' })).toBeChecked();
  await expect(page.getByText('INSIGNIAS DE LA RACHA')).toHaveCount(0);
});
