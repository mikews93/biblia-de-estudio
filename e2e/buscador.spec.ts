// Buscador (/buscar): citas escritas de muchas formas, versiones que aún no están, citas que no existen,
// búsquedas recientes y búsqueda por idea con IA (con y sin cuenta).

import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { conSesion, correoUnico, cuentaNueva, expect, peticionesIA, test } from './support/fixtures';

type Verse = [number, string, string?];

async function versiculo(request: APIRequestContext, book: string, chapter: number, verse: number, version = 'rv1909') {
  const res = await request.get(`/data/text/${version}/${book}/${chapter}.json`);
  return ((await res.json()) as Verse[]).find(([n]) => n === verse)![1];
}

// La pila de pantallas deja las anteriores montadas y ocultas: se busca solo en lo que se ve.
const visible = (l: Locator) => l.filter({ visible: true });
const texto = (page: Page, t: string | RegExp) => visible(page.getByText(t)).first();
const campo = (page: Page) => visible(page.getByRole('textbox', { name: 'Buscar una cita, unas palabras o una idea' }));

/** Abre el buscador desde Hoy, como lo haría la persona. */
async function abrirBuscador(page: Page) {
  await page.goto('/');
  await page.getByRole('search', { name: 'Buscar una cita, unas palabras o una idea' }).click();
  await expect(page).toHaveURL(/\/buscar$/);
  await expect(campo(page)).toBeVisible();
}

test('una cita abreviada abre el versículo, y escrita con espacios se ve antes de abrirla', async ({ page, request }) => {
  const jn316 = await versiculo(request, 'jhn', 3, 16);
  await abrirBuscador(page);

  // «Jn 3:16» + Enter: directo al versículo, seleccionado
  await campo(page).fill('Jn 3:16');
  await campo(page).press('Enter');
  await expect(page).toHaveURL(/\/juan\/3\/16$/);
  await expect(texto(page, 'Juan 3:16')).toBeVisible();
  await expect(texto(page, jn316)).toBeVisible();

  // «juan 3 16»: la tarjeta muestra la cita con su texto y la versión, y el botón la abre
  await page.goto('/buscar');
  await campo(page).fill('juan 3 16');
  await expect(texto(page, 'Juan 3:16')).toBeVisible();
  await expect(texto(page, jn316)).toBeVisible();
  await expect(texto(page, 'RV1909')).toBeVisible();
  await visible(page.getByRole('link', { name: 'Abrir en Juan 3 ›' })).click();
  await expect(page).toHaveURL(/\/juan\/3\/16$/);

  // Un capítulo entero, con números dichos en palabras
  await page.goto('/buscar');
  await campo(page).fill('salmo veintitres');
  await expect(texto(page, 'Salmos 23')).toBeVisible();
  await visible(page.getByRole('link', { name: 'Leer Salmos 23 ›' })).click();
  await expect(page).toHaveURL(/\/salmos\/23$/);
  await expect(texto(page, (await versiculo(request, 'psa', 23, 1)).slice(0, 40))).toBeVisible();
});

test('una versión que aún no está avisa y abre en la versión actual; una que sí está, cambia a ella', async ({
  page,
  request,
}) => {
  const reyes = await versiculo(request, '1ki', 2, 5);
  await page.goto('/buscar');

  // NBLA: se queda en el buscador con el aviso y el texto en RV1909
  await campo(page).fill('1 reyes 2:5 nbla');
  await campo(page).press('Enter');
  await expect(
    texto(page, 'La NBLA todavía no está en la app; estamos pidiendo el permiso para incluirla. Mientras tanto, aquí está en Reina-Valera 1909.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/buscar/);
  await expect(texto(page, '1 Reyes 2:5')).toBeVisible();
  await expect(texto(page, reyes.slice(0, 60))).toBeVisible();
  await visible(page.getByRole('link', { name: 'Abrir en 1 Reyes 2 ›' })).click();
  await expect(page).toHaveURL(/\/1-reyes\/2\/5$/);
  await expect(visible(page.getByRole('button', { name: /Cambiar versión/ }))).toHaveText('RV1909');
  await expect(texto(page, reyes.slice(0, 60))).toBeVisible();

  // «Juan 3:16 BES»: abre en la BES y la deja como versión de lectura
  await page.goto('/buscar');
  await campo(page).fill('Juan 3:16 BES');
  await expect(texto(page, await versiculo(request, 'jhn', 3, 16, 'bes'))).toBeVisible();
  await campo(page).press('Enter');
  await expect(page).toHaveURL(/\/juan\/3\/16$/);
  await expect(visible(page.getByRole('button', { name: /Cambiar versión/ }))).toHaveText('BES');
  await page.goto('/romanos/8');
  await expect(texto(page, (await versiculo(request, 'rom', 8, 1, 'bes')).slice(0, 40))).toBeVisible();
});

test('una cita que no existe dice por qué y no se abre', async ({ page }) => {
  await page.goto('/buscar');

  await campo(page).fill('Juan 30');
  await expect(texto(page, 'Juan tiene 21 capítulos.')).toBeVisible();
  await expect(visible(page.getByRole('link', { name: /Leer Juan|Abrir en Juan/ }))).toHaveCount(0);
  await campo(page).press('Enter');
  await expect(page).toHaveURL(/\/buscar/);
  await expect(texto(page, 'Juan tiene 21 capítulos.')).toBeVisible();

  // El capítulo existe pero el versículo no
  await campo(page).fill('Salmo 119:200');
  await expect(texto(page, 'Salmos 119 tiene 176 versículos.')).toBeVisible();
  await campo(page).press('Enter');
  await expect(page).toHaveURL(/\/buscar/);
});

test('las búsquedas recientes se guardan, se reabren y se pueden borrar', async ({ page }) => {
  await page.goto('/buscar');
  await campo(page).fill('Ef 2:8');
  await campo(page).press('Enter');
  await expect(page).toHaveURL(/\/efesios\/2\/8$/);

  // Al volver (tras recargar) aparece en Recientes y lleva otra vez al versículo
  await page.goto('/buscar');
  await expect(texto(page, 'Recientes')).toBeVisible();
  await visible(page.getByText('Ef 2:8', { exact: true })).click();
  await expect(page).toHaveURL(/\/efesios\/2\/8$/);

  await page.goto('/buscar');
  await visible(page.getByText('Borrar', { exact: true })).click();
  await expect(texto(page, 'Recientes')).toBeHidden();
  await page.reload();
  await expect(texto(page, 'Ir a una cita')).toBeVisible();
  await expect(texto(page, 'Recientes')).toBeHidden();
  await expect(visible(page.getByText('Ef 2:8', { exact: true }))).toHaveCount(0);
});

/** Lo que propone la IA simulada y se queda tras comprobarlo: Filipenses 4:6 y Mateo 6:34. */
async function comprobarResultados(page: Page, request: APIRequestContext, consulta: string) {
  const [fil, mat] = await Promise.all([versiculo(request, 'php', 4, 6), versiculo(request, 'mat', 6, 34)]);
  await expect(texto(page, `2 pasajes para «${consulta}»`)).toBeVisible({ timeout: 20_000 });
  const filipenses = visible(page.getByRole('link', { name: /^Filipenses 4:6/ }));
  const mateo = visible(page.getByRole('link', { name: /^Mateo 6:34/ }));
  // Con el texto real de la RV1909 y el porqué
  await expect(filipenses).toContainText(fil);
  await expect(filipenses).toContainText('Pide no estar afanosos y presentar todo a Dios en oración.');
  await expect(mateo).toContainText(mat);
  await expect(mateo).toContainText('Jesús enseña a no afanarse por el día de mañana.');
  // Las que la IA propuso y no se quedaron (o no existen) no salen
  await expect(texto(page, /Juan 3:16|Génesis 99/)).toHaveCount(0);
  return filipenses;
}

test('buscar por idea sin cuenta pide crearla y, al crearla, hace la búsqueda', async ({ page, request }) => {
  const consulta = `me preocupa el futuro ${Date.now().toString(36)}`;
  await page.goto('/buscar');
  await campo(page).fill(consulta);
  await campo(page).press('Enter');

  await expect(texto(page, 'Busca por idea')).toBeVisible();
  await expect(texto(page, /Necesitas una cuenta gratuita/)).toBeVisible();
  // Sin cuenta no se llama a la IA
  expect(await peticionesIA(request, consulta)).toHaveLength(0);

  await visible(page.getByRole('button', { name: 'Crear cuenta gratis' })).click();
  await expect(page).toHaveURL(/\/registro$/);
  await visible(page.getByPlaceholder('Así te verán tus grupos y amigos')).fill('Lectora');
  await visible(page.getByPlaceholder('tu@correo.com')).fill(correoUnico('lectora'));
  await visible(page.getByPlaceholder('Elige una contraseña')).fill('clave-segura-1');
  await visible(page.getByRole('button', { name: 'Crear mi cuenta' })).click();

  // Vuelve al buscador y la búsqueda se hace sola
  await expect(page).toHaveURL(/\/buscar/);
  await comprobarResultados(page, request, consulta);
  expect((await peticionesIA(request, consulta)).length).toBeGreaterThan(0);
});

test('con cuenta, la búsqueda por idea muestra pasajes comprobados y abre el elegido', async ({ page, request }) => {
  await conSesion(page, await cuentaNueva(request, 'Buscadora'));
  const consulta = `ansiedad por el mañana ${Date.now().toString(36)}`;
  await abrirBuscador(page);
  await campo(page).fill(consulta);
  await campo(page).press('Enter');

  const filipenses = await comprobarResultados(page, request, consulta);
  // La IA recibió lo que se escribió
  expect((await peticionesIA(request, consulta)).length).toBeGreaterThan(0);
  // La búsqueda queda en la dirección: al recargar se repite
  await expect(page).toHaveURL(/\/buscar\?q=/);

  await filipenses.click();
  await expect(page).toHaveURL(/\/filipenses\/4\/6$/);
  await expect(texto(page, 'Filipenses 4:6')).toBeVisible();

  // Volver deja los resultados donde estaban
  await page.goBack();
  await expect(texto(page, `2 pasajes para «${consulta}»`)).toBeVisible();
});
