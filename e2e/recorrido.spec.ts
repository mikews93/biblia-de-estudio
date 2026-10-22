import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './support/fixtures';

// El mapa que sigue la lectura: a mano, parada por parada, y al escuchar el capítulo, donde el mapa avanza solo
// según los tiempos de cada versículo.

const v = (l: Locator) => l.filter({ visible: true });
const TONO = readFileSync(join(__dirname, 'support', 'tono.mp3'));

/** Marcos 1 con un dramatizado de prueba de 12 s: el v. 9 empieza a los 3 s y el v. 21 (Capernaum) a los 7 s. */
async function conDramatizado(page: Page) {
  await page.route('**/audio/index.json', (r) => r.fulfill({ json: { dramatizado: ['mrk-1'], podcast: [] } }));
  await page.route('**/audio/dramatizado/mrk-1.json', (r) =>
    r.fulfill({
      json: { id: 'mrk-1', titulo: 'Marcos 1', duracion: 12, timestamps: [[1, 0], [9, 3], [21, 7]], credito: 'Audio dramatizado de prueba' },
    }),
  );
  await page.route('**/audio/dramatizado/mrk-1.mp3', (r) => r.fulfill({ body: TONO, contentType: 'audio/mpeg' }));
}

test.describe('Mapa que sigue la lectura', () => {
  test.use({ serviceWorkers: 'block' });

  test('desde el lector se sigue el recorrido a mano y luego con el audio dramatizado', async ({ page }) => {
    await conDramatizado(page);
    await page.goto('/marcos/1');
    await v(page.getByRole('button', { name: 'Seguir en el mapa: Jesús en Galilea' })).click();
    await expect(page).toHaveURL(/\/recorrido\/marcos\/1$/);

    // Empieza en el bautismo (1:9): Nazaret y el Jordán caen en el mismo versículo y se recorren uno tras otro
    await expect(v(page.getByText(/Jesús en Galilea\s+·\s+1 de 16/))).toBeVisible();
    await expect(v(page.getByText('Jesús sale de Nazaret de Galilea', { exact: true }))).toBeVisible();
    await expect(v(page.getByText('Juan lo bautiza en el Jordán', { exact: true }))).toBeVisible({ timeout: 6000 });
    await expect(v(page.getByText('A tu ritmo'))).toBeVisible();

    await v(page.getByRole('button', { name: 'Parada siguiente' })).click();
    await expect(v(page.getByText('El Espíritu lo lleva al desierto: cuarenta días', { exact: true }))).toBeVisible();
    await expect(v(page.getByText('Y luego el Espíritu le impele al desierto.'))).toBeVisible();

    // Al escuchar, el mapa va solo a cada parada y la barra del reproductor se esconde: el mapa trae sus controles
    await v(page.getByRole('button', { name: 'Escuchar el capítulo dramatizado' })).click();
    await expect(v(page.getByText(/Siguiendo · audio dramatizado/))).toBeVisible();
    await expect(v(page.getByRole('button', { name: 'Cerrar el reproductor' }))).toHaveCount(0);
    await expect(v(page.getByText('Mr 1:1'))).toBeVisible();
    await expect(v(page.getByText('Enseña en la sinagoga de Capernaum', { exact: true }))).toBeVisible({ timeout: 15000 });
    await expect(v(page.getByText('Mr 1:21'))).toBeVisible();

    // Dejar de escuchar vuelve a avanzar a mano desde donde iba
    await v(page.getByRole('button', { name: 'Dejar de escuchar' })).click();
    await expect(v(page.getByText('A tu ritmo'))).toBeVisible();
    await expect(v(page.getByText('Mr 1:21'))).toBeVisible();
  });

  test('la lista de recorridos abre cada viaje y un capítulo cualquiera resalta sus lugares', async ({ page }) => {
    await page.goto('/recorridos');
    await expect(v(page.getByText('El mapa que sigue la lectura'))).toBeVisible();
    await v(page.getByRole('button', { name: /^Primer viaje de Pablo/ })).click();
    await expect(page).toHaveURL(/\/recorrido\/hechos\/13\?v=1$/);
    await expect(v(page.getByText('La iglesia de Antioquía aparta a Bernabé y a Saulo', { exact: true }))).toBeVisible();

    // Al final de Hechos 13 el viaje sigue en el capítulo 14
    await v(page.getByRole('button', { name: /Parada 7: Iconio/ })).click();
    await expect(v(page.getByText('El viaje continúa'))).toBeVisible();
    await v(page.getByRole('button', { name: /El viaje continúa|Hechos 14/ }).first()).click();
    await expect(page).toHaveURL(/\/recorrido\/hechos\/14\?v=6$/);
    await expect(v(page.getByText('Listra: sanan a un cojo y apedrean a Pablo', { exact: true }))).toBeVisible();

    await page.goto('/recorrido/genesis/12?v=6');
    await expect(v(page.getByText(/Lugares de Génesis 12/))).toBeVisible();
    await expect(v(page.getByText('Moreh, Sichêm'))).toBeVisible();
    await v(page.getByRole('button', { name: 'Lugar siguiente' })).click();
    await expect(v(page.getByText('Gn 12:8'))).toBeVisible();
  });
});
