import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { abrirHoja, conSesion, cuentaNueva, expect, test } from './support/fixtures';

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
    await abrirHoja(page, 'escuchar');
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

    // Otra pantalla: la barra sigue y el audio no se corta. Si el lector se desplazó mientras sonaba (con la
    // máquina cargada pasa), las barras se apartaron y la píldora de capítulos queda bajo el reproductor:
    // se sube un poco, como haría quien lee, para que vuelvan.
    const titulo = v(page.getByRole('button', { name: 'Elegir libro y capítulo' }));
    await page.mouse.move(200, 300);
    await expect(async () => {
      await page.mouse.wheel(0, -200);
      await expect(titulo).toBeInViewport({ timeout: 1000 });
    }).toPass();
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

  test('el pódcast con voces naturales se graba al pedirlo y suena en la barra', async ({ page, request }, info) => {
    // Cada proyecto usa su capítulo: el guion lo prepara la IA simulada y el servidor lo guarda para todos.
    const cap = info.project.name === 'movil' ? 14 : 15;
    await page.route('**/audio/index.json', (r) => r.fulfill({ json: { dramatizado: [], podcast: [] } }));
    let grabado = false;
    await page.route('**/api/podcast-grabado**', async (r) => {
      if (r.request().method() === 'POST') {
        await new Promise((ok) => setTimeout(ok, 600));
        grabado = true;
      }
      await r.fulfill({
        json: grabado ? { estado: 'listo', url: '/prueba/podcast.mp3', duracion: 12, credito: 'Voces de prueba' } : { estado: 'ninguno' },
      });
    });
    await page.route('**/prueba/podcast.mp3', (r) => r.fulfill({ body: TONO, contentType: 'audio/mpeg' }));
    await conSesion(page, await cuentaNueva(request, 'Oyente'));

    await page.goto(`/podcast/juan/${cap}`);
    await expect(v(page.getByText('Este capítulo empieza con una sorpresa.'))).toBeVisible();
    await v(page.getByRole('button', { name: 'Grabar este pódcast con voces naturales' })).click();
    await expect(v(page.getByText('Grabando con voces naturales…'))).toBeVisible();

    // Ya grabado, el reproductor de la pantalla suena con esas voces: no queda la voz del dispositivo.
    await expect(v(page.getByText(/^1 de \d+ · voces naturales$/))).toBeVisible();
    await expect(page.getByText(/voz del dispositivo/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Grabar este pódcast con voces naturales' })).toHaveCount(0);
    await v(page.getByRole('button', { name: 'Escuchar', exact: true })).click();

    await expect(v(page.getByText('Pódcast · habla Ana'))).toBeVisible();
    await expect(v(page.getByText('Voces de prueba'))).toBeVisible();
    await expect(v(page.getByRole('button', { name: 'Pausa', exact: true }))).toBeVisible();
    // La transcripción sigue a la grabación
    await expect(v(page.getByText(/^2 de \d+ · voces naturales$/))).toBeVisible({ timeout: 15_000 });
    // Tocar una intervención salta a ella
    await v(page.getByText('Este capítulo empieza con una sorpresa.')).click();
    await expect(v(page.getByText(/^1 de \d+ · voces naturales$/))).toBeVisible();
  });
});
