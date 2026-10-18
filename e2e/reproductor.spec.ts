import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './support/fixtures';

// Reproductor único: el audio dramatizado (y todo lo que suena) va a la misma barra, sigue sonando al cambiar
// de pantalla y se anuncia a la Media Session del navegador para controlarlo desde la pantalla de bloqueo.

const v = (l: Locator) => l.filter({ visible: true });
const TONO = readFileSync(join(__dirname, 'support', 'tono.mp3'));

/** Simula que Marcos 1 tiene audio dramatizado publicado, con un tono de 12 s en vez de la grabación. */
async function conDramatizado(page: Page) {
  await page.route('**/audio/index.json', (r) => r.fulfill({ json: { dramatizado: ['mrk-1'], podcast: [] } }));
  await page.route('**/audio/dramatizado/mrk-1.json', (r) =>
    r.fulfill({
      json: { id: 'mrk-1', titulo: 'Marcos 1', duracion: 12, timestamps: [[1, 0], [2, 4], [3, 8]], credito: 'Audio dramatizado de prueba' },
    }),
  );
  await page.route('**/audio/dramatizado/mrk-1.mp3', (r) => r.fulfill({ body: TONO, contentType: 'audio/mpeg' }));
}

test.describe('Reproductor único', () => {
  // Con el service worker activo, sus peticiones no pasan por page.route y no se podría simular la grabación.
  test.use({ serviceWorkers: 'block' });

  test('el dramatizado suena en la barra, sigue al cambiar de pantalla y llega a la Media Session', async ({ page }) => {
    await conDramatizado(page);
    await page.goto('/marcos/1');
    await v(page.getByRole('button', { name: 'Escuchar el capítulo dramatizado, con voces, efectos y música' })).click();

    await expect(v(page.getByText('Audio dramatizado', { exact: true }))).toBeVisible();
    await expect(v(page.getByRole('tab', { name: 'Dramatizado', selected: true }))).toBeVisible();
    await expect(v(page.getByRole('tab', { name: 'Lectura' }))).toBeVisible();
    await expect(v(page.getByRole('button', { name: 'Pausa' }))).toBeVisible();
    await expect(v(page.getByText('Audio dramatizado de prueba'))).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => navigator.mediaSession.metadata && [navigator.mediaSession.metadata.title, navigator.mediaSession.metadata.artist]))
      .toEqual(['Marcos 1', 'Audio dramatizado']);
    // El versículo avanza con los tiempos de la grabación
    await expect(v(page.getByText(/v\. 2/))).toBeVisible({ timeout: 15_000 });

    // Otra pantalla: la barra sigue y el audio no se corta
    await v(page.getByLabel('Capítulo siguiente')).click();
    await expect(page).toHaveURL(/\/marcos\/2$/);
    await expect(v(page.getByText('Audio dramatizado', { exact: true }))).toBeVisible();
    expect(await page.evaluate(() => navigator.mediaSession.playbackState)).toBe('playing');

    await v(page.getByRole('button', { name: 'Cerrar el reproductor' })).click();
    await expect(v(page.getByText('Audio dramatizado', { exact: true }))).toHaveCount(0);
  });

  test('sin dramatizado publicado, el capítulo solo ofrece la lectura', async ({ page }) => {
    await page.route('**/audio/index.json', (r) => r.fulfill({ json: { dramatizado: [], podcast: [] } }));
    await page.goto('/marcos/1');
    await expect(v(page.getByRole('button', { name: 'Escuchar la lectura del capítulo' }))).toBeVisible();
    await expect(page.getByRole('button', { name: /dramatizado/ })).toHaveCount(0);
  });
});
