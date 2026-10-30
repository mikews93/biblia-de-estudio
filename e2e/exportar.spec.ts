import { readFileSync } from 'node:fs';

import { expect, test } from './support/fixtures';

// «Llévate lo tuyo»: lo escrito en el dispositivo sale en un documento, sin cuenta.
test('guarda notas, resaltados y diario en un documento para Word', async ({ page }) => {
  await page.addInitScript(() => {
    const ahora = Date.now();
    localStorage.setItem('notas', JSON.stringify({ 'jhn.3.16': { text: 'Dios me amó primero', created: ahora, updated: ahora } }));
    localStorage.setItem('resaltados', JSON.stringify({ 'psa.23.1': { color: 'verde', at: ahora } }));
    localStorage.setItem(
      'diario',
      JSON.stringify([{ id: 'd1', book: 'psa', chapter: 23, reference: 'Salmos 23', palabra: 'nada me faltará', oracion: 'Gracias, Señor', paso: 'Llamar a Ana', created: ahora }]),
    );
  });
  await page.goto('/notas');
  await page.getByRole('link', { name: /Guardar todo en un documento/ }).click();
  await expect(page).toHaveURL(/\/exportar$/);

  await expect(page.getByRole('checkbox', { name: 'Notas y resaltados: 2' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('checkbox', { name: 'Diario devocional: 1' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('checkbox', { name: 'Oraciones: 0' })).toHaveAttribute('aria-disabled', 'true');

  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Documento para Word' }).click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(/^zarza-lo-mio-\d{4}-\d{2}-\d{2}\.doc$/);
  const html = readFileSync((await archivo.path())!, 'utf8');
  expect(html).toContain('Juan 3:16');
  expect(html).toContain('Dios me amó primero');
  // El texto del versículo resaltado va en la RV1909
  expect(html).toContain('JEHOVÁ es mi pastor');
  expect(html).toContain('Llamar a Ana');

  // Sin el diario, el documento ya no lo lleva
  await page.getByRole('checkbox', { name: 'Diario devocional: 1' }).click();
  const otra = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Documento para Word' }).click();
  expect(readFileSync((await (await otra).path())!, 'utf8')).not.toContain('Llamar a Ana');
});
