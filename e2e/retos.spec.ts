import type { Locator } from '@playwright/test';

import { planById } from '../src/lib/planesCatalogo';
import { nextSeason } from '../src/lib/temporadas';
import { conSesion, cuentaNueva, expect, test } from './support/fixtures';

// Retos de temporada: unirse al de Adviento, leer lo del día, responder la pregunta, ver los hitos y hacerlo
// con un grupo. El reloj del navegador se fija en el tercer día del próximo Adviento.

/** La pila de pantallas deja las anteriores en el DOM, ocultas: solo cuentan las visibles. */
const v = (l: Locator) => l.filter({ visible: true });

const Y = nextSeason(planById('adviento')!)!.year;
const DIA_3 = new Date(`${Y}-12-03T10:00:00`);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(DIA_3);
});

test('unirse al reto de Adviento, leer lo de hoy, responder la pregunta y celebrar el primer paso', async ({ page }) => {
  await page.goto('/planes');
  await expect(v(page.getByText('Retos de temporada'))).toBeVisible();
  await v(page.getByRole('button', { name: /^Adviento: la promesa cumplida\. En curso/ })).click();
  await expect(page).toHaveURL(/\/planes\/adviento$/);

  // Antes de unirse: cómo funciona y en qué día va
  await expect(v(page.getByText('Cómo funciona'))).toBeVisible();
  await expect(v(page.getByText('Hoy es el día 3 de 25'))).toBeVisible();
  await expect(v(page.getByText('El morado del Adviento habla de espera y preparación.'))).toBeVisible();
  await v(page.getByRole('button', { name: 'Unirme al reto' })).click();

  // Se abre el día de hoy con su lectura y su pregunta
  await expect(v(page.getByText('0 de 25'))).toBeVisible();
  await expect(v(page.getByText('Día 3 · hoy'))).toBeVisible();
  await expect(v(page.getByText('Un trono para siempre', { exact: true }))).toBeVisible();
  await expect(v(page.getByText(/Dios promete a David un trono para siempre/))).toBeVisible();
  await expect(v(page.getByText('Ya empezó', { exact: false }))).toHaveCount(0);

  // Leer 2 Samuel 7 y marcarlo: el cierre del capítulo trae la pregunta del reto
  await v(page.getByRole('button', { name: 'Leer 2 Samuel 7' })).click();
  await expect(page).toHaveURL(/\/2-samuel\/7$/);
  await v(page.getByRole('button', { name: 'Terminé este capítulo' })).click();
  await expect(v(page.getByText('PARA PENSAR · RETO DE ADVIENTO'))).toBeVisible();
  await v(page.getByRole('link', { name: 'Escribir mi respuesta ›' })).click();
  await expect(page).toHaveURL(/\/planes\/adviento\?dia=3$/);

  // El día queda leído y se celebra el primer hito
  await expect(v(page.getByText('1 de 25'))).toBeVisible();
  await expect(v(page.getByText(/✓ Leído el 3 de diciembre/))).toBeVisible();
  await expect(v(page.getByText('✦ Primer paso'))).toBeVisible();
  await expect(v(page.getByLabel('Primer paso, alcanzado'))).toBeVisible();

  // Responder la pregunta: se guarda en el dispositivo y sigue ahí al recargar
  await v(page.getByLabel('Tu respuesta')).fill('Que Dios cumple sus promesas aunque tarden.');
  await v(page.getByRole('button', { name: 'Guardar respuesta' })).click();
  await expect(v(page.getByText('Guardado en tu dispositivo ✓'))).toBeVisible();
  await page.reload();
  await expect(v(page.getByLabel('Tu respuesta'))).toHaveValue('Que Dios cumple sus promesas aunque tarden.');
  await expect(v(page.getByText('respuesta escrita'))).toBeVisible();

  // Los días anteriores esperan sin culpa; tocar uno en el calendario lo abre
  await expect(v(page.getByText('2 lecturas de días anteriores te esperan.', { exact: false }))).toBeVisible();
  await v(page.getByRole('button', { name: /^Día 1, martes, 1 de diciembre, te espera$/ })).click();
  await expect(v(page.getByText('La primera promesa'))).toBeVisible();
  await expect(v(page.getByRole('button', { name: 'Leer Génesis 3' }))).toBeVisible();

  // En Hoy el reto aparece con su pregunta y lo siguiente por leer
  await page.goto('/');
  await expect(v(page.getByText('Reto de Adviento'))).toBeVisible();
  await expect(v(page.getByText(/^Génesis 3 · \d+ min$/))).toBeVisible();

  // En Planes, la tarjeta del reto dice que te uniste
  await page.goto('/planes');
  await expect(v(page.getByRole('button', { name: /^Adviento: la promesa cumplida\. En curso.*Te uniste$/ }))).toBeVisible();
});

test('hacer el reto con un grupo: el grupo ve el día, la pregunta para conversar y quién leyó', async ({ page, request }) => {
  const ana = await cuentaNueva(request, 'Ana Reto');
  await conSesion(page, ana);
  const nombre = `Célula de Adviento ${Math.random().toString(36).slice(2, 7)}`;

  await page.goto('/planes/adviento');
  await v(page.getByRole('button', { name: 'Hacerlo con mi grupo' })).click();
  await expect(page).toHaveURL(/\/grupos\/nuevo\?reto=adviento$/);
  await expect(v(page.getByRole('radio', { name: `✶ Adviento ${Y}` }))).toBeVisible();
  await expect(v(page.getByText(`Del 1 de diciembre al 25 de diciembre: 25 lecturas`, { exact: false }))).toBeVisible();
  await v(page.getByPlaceholder('Célula de los jueves')).fill(nombre);
  await v(page.getByRole('button', { name: 'Crear el grupo' })).click();

  await expect(page).toHaveURL(/\/grupos\/[0-9a-f-]{36}\?nuevo=1$/);
  await expect(v(page.getByText('RETO DE ADVIENTO · DÍA 3 DE 25'))).toBeVisible();
  await expect(v(page.getByText('Un trono para siempre', { exact: true }))).toBeVisible();
  await expect(v(page.getByText('PARA CONVERSAR'))).toBeVisible();
  await expect(v(page.getByText('Nadie ha leído todavía hoy.'))).toBeVisible();

  // Ana lee lo de hoy desde el grupo y el grupo lo ve
  await v(page.getByRole('button', { name: 'Leer 2 Samuel 7' })).click();
  await expect(page).toHaveURL(/\/2-samuel\/7$/);
  await v(page.getByRole('button', { name: 'Terminé este capítulo' })).click();
  await expect(v(page.getByText(`${nombre}: 1 de 1 leyeron hoy ›`))).toBeVisible();

  // En su reto personal, el grupo aparece en compañía
  await page.goto('/planes/adviento');
  await v(page.getByRole('button', { name: 'Unirme al reto' })).click();
  await expect(v(page.getByRole('link', { name: new RegExp(nombre) }))).toContainText('1 de 1 leyeron la lectura de hoy');
});
