import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './support/fixtures';

// Lectura en la lengua original: el capítulo suena en griego (o hebreo) y cada palabra del interlineal se ilumina
// mientras se lee, con su glosa en la barra del reproductor.

const v = (l: Locator) => l.filter({ visible: true });
const TONO = readFileSync(join(__dirname, 'support', 'tono.mp3'));

/** Simula que Juan 3 tiene la lectura en griego alineada, con un tono de 12 s en vez de la grabación. */
async function conGriego(page: Page) {
  await page.route('**/audio/index.json', (r) => r.fulfill({ json: { dramatizado: [], podcast: [], original: ['jhn-3'] } }));
  await page.route('**/audio/original/jhn-3.json', (r) =>
    r.fulfill({
      json: {
        idioma: 'griego',
        src: 'https://archive.org/download/prueba/04John03.mp3',
        duracion: 12,
        lector: 'Marilyn Phemister',
        credito: 'Lectura en griego de prueba',
        timestamps: [[1, 0], [2, 6]],
        // v. 1: «Ἦν δὲ ἄνθρωπος…» palabra por palabra; la segunda palabra no se lee (null)
        palabras: { '1': [[0, 1.5], null, [1.5, 3], [3, 4.5], [4.5, 6]], '2': [[6, 9], [9, 12]] },
      },
    }),
  );
  await page.route('https://archive.org/**', (r) => r.fulfill({ body: TONO, contentType: 'audio/mpeg' }));
}

test.describe('Audio en hebreo y griego', () => {
  test.use({ serviceWorkers: 'block' });

  test('el capítulo suena en griego, ilumina la palabra que se lee y salta a la palabra tocada', async ({ page }) => {
    await conGriego(page);
    await page.goto('/juan/3');
    await v(page.getByRole('button', { name: /Escuchar el capítulo en griego/ })).click();

    await expect(v(page.getByText('En griego · Marilyn Phemister'))).toBeVisible();
    await expect(v(page.getByRole('tab', { name: 'Griego', selected: true }))).toBeVisible();
    await expect(v(page.getByRole('tab', { name: 'Lectura' }))).toBeVisible();
    await expect(v(page.getByText('Lectura en griego de prueba'))).toBeVisible();

    // Sin el modo estudio, el lector muestra el interlineal mientras suena
    await expect(v(page.getByText(/se ilumina mientras suena/))).toBeVisible();
    // La barra enseña la palabra que suena con su versículo; a los 6 s pasa al versículo 2
    await expect(v(page.getByText(/· v\. 1$/))).toBeVisible();
    await expect(v(page.getByText(/· v\. 2$/))).toBeVisible({ timeout: 15_000 });

    // Tocar la tercera palabra del versículo 1 vuelve a ella (1,5 s)
    const palabra = v(page.getByLabel(/^ἄνθρωπος, /)).first();
    await palabra.click();
    await expect(v(page.getByText(/· v\. 1$/))).toBeVisible();
    await expect(v(page.getByText(/^anthrōpos · v\. 1$/))).toBeVisible();
  });
});
