// La versión que lee la persona también en la búsqueda por idea y en el estudio con IA.
// - Libre (BES): la IA lee esa versión y los resultados salen en ella.
// - Con derechos (NBLA): la IA trabaja con la RV1909, pero la persona ve los versículos en su NBLA, pedidos en el
//   momento con su aviso de derechos. API.Bible se simula como en versiones-licencia.spec.ts.

import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { LICENSED } from '../src/lib/licenciadas';
import { conSesion, cuentaNueva, expect, test } from './support/fixtures';

const visible = (l: Locator) => l.filter({ visible: true });
const texto = (page: Page, t: string | RegExp) => visible(page.getByText(t)).first();
const campo = (page: Page) => visible(page.getByRole('textbox', { name: 'Buscar una cita, unas palabras o una idea' }));

const NBLA = LICENSED.find((v) => v.id === 'nbla')!;
const nbla = (book: string, chapter: number, verse: number) => `NBLA simulada de ${book} ${chapter}:${verse}.`;

async function simularApiBible(page: Page) {
  await page.route('**/api/biblia?*', async (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get('versiones')) {
      return route.fulfill({ json: { versions: [NBLA].map(({ bibleId: _, ...v }) => ({ ...v, licensed: true, guardable: true })) } });
    }
    const [book, chapter] = [q.get('book')!, Number(q.get('chapter'))];
    const verses = Array.from({ length: 40 }, (_, i) => [i + 1, nbla(book, chapter, i + 1)]);
    return route.fulfill({ json: { verses, copyright: NBLA.credit, guardable: true, fums: null } });
  });
}

/** Deja elegida una versión y el estudio profundo, como si la persona ya los hubiera escogido. */
async function leyendoEn(page: Page, version: string) {
  await page.addInitScript((v) => {
    window.localStorage.setItem('ajustes', JSON.stringify({ enfoque: 'profundo', version: v }));
  }, version);
}

async function versiculo(request: APIRequestContext, version: string, book: string, chapter: number, verse: number) {
  const res = await request.get(`/data/text/${version}/${book}/${chapter}.json`);
  return ((await res.json()) as [number, string][]).find(([n]) => n === verse)![1];
}

async function buscar(page: Page, consulta: string) {
  await page.goto('/buscar');
  await campo(page).fill(consulta);
  await campo(page).press('Enter');
  // Primero salen los resultados rápidos (sin IA); la IA los afina a petición
  await expect(texto(page, `para «${consulta}»`)).toBeVisible();
  await visible(page.getByRole('button', { name: 'Afinar con la IA' })).click();
  await expect(texto(page, `2 pasajes para «${consulta}»`)).toBeVisible();
}

const captura = (page: Page, nombre: string) =>
  page.waitForTimeout(500).then(() => page.screenshot({ path: `test-results/capturas/version-${nombre}-${test.info().project.name}.png` }));

test('buscar por idea con la NBLA muestra cada pasaje en la NBLA, con su aviso', async ({ page, request }) => {
  await simularApiBible(page);
  await leyendoEn(page, 'nbla');
  await conSesion(page, await cuentaNueva(request, 'Lectora NBLA'));
  const pedido = page.waitForRequest((r) => r.url().endsWith('/api/buscar'));
  await buscar(page, `ansiedad ${Date.now().toString(36)}`);
  expect((await pedido).postDataJSON()).toMatchObject({ version: 'nbla' });

  await expect(texto(page, nbla('php', 4, 6))).toBeVisible();
  await expect(texto(page, nbla('mat', 6, 34))).toBeVisible();
  await expect(texto(page, await versiculo(request, 'rv1909', 'php', 4, 6))).toHaveCount(0);
  await expect(texto(page, 'la IA buscó con la Reina-Valera 1909 y aquí ves cada pasaje en tu NBLA')).toBeVisible();
  await expect(texto(page, 'Copyright © 2005 by The Lockman Foundation')).toBeVisible();
  await expect(visible(page.getByRole('link', { name: 'NuevaBiblia.com (Español)' })).first()).toBeVisible();
  // Que se vaya el aviso de «progreso guardado» antes de la captura
  await expect(texto(page, 'Tu progreso quedó guardado')).toHaveCount(0, { timeout: 15_000 });
  await captura(page, '1-buscar-nbla');
  await page.emulateMedia({ colorScheme: 'dark' });
  await captura(page, '1-buscar-nbla-oscuro');
});

test('buscar por idea con una versión libre la usa también para la IA', async ({ page, request }) => {
  await leyendoEn(page, 'bes');
  await conSesion(page, await cuentaNueva(request, 'Lector BES'));
  await buscar(page, `ansiedad ${Date.now().toString(36)}`);
  await expect(texto(page, await versiculo(request, 'bes', 'php', 4, 6))).toBeVisible();
  await expect(texto(page, 'Los textos son los de la BES (La Biblia en Español Sencillo)')).toBeVisible();
});

test('el estudio con la NBLA muestra los versículos en la NBLA en vez de citar la RV1909', async ({ page, request }) => {
  await simularApiBible(page);
  await leyendoEn(page, 'nbla');
  await conSesion(page, await cuentaNueva(request, 'Estudiante NBLA'));
  await page.goto('/juan/3');
  await visible(page.getByRole('button', { name: 'Estudiar este capítulo' })).click();

  const estudio = page.getByRole('dialog').filter({ hasText: 'ESTUDIO' });
  await expect(estudio.getByText('Versículos en tu versión')).toBeVisible();
  // ⟪Juan 3:16⟫ en su línea: una tarjeta con el versículo en la NBLA y el aviso de Lockman
  await expect(estudio.getByText(nbla('jhn', 3, 16))).toBeVisible();
  await expect(estudio.getByText('Copyright © 2005 by The Lockman Foundation').first()).toBeVisible();
  // ⟪Juan 3:3⟫ dentro de una frase: entre comillas
  await expect(estudio.getByText(`«${nbla('jhn', 3, 3)}»`)).toBeVisible();
  await expect(estudio.getByText('⟪')).toHaveCount(0);
  await estudio.getByText(`«${nbla('jhn', 3, 3)}»`).scrollIntoViewIfNeeded();
  await captura(page, '2-estudio-nbla');
  await page.emulateMedia({ colorScheme: 'dark' });
  await captura(page, '3-estudio-nbla-oscuro');
  await page.emulateMedia({ colorScheme: 'light' });

  // Tocar la tarjeta lleva al versículo
  await estudio.getByRole('link', { name: 'Juan 3:16: leer en su capítulo' }).click();
  await expect(page).toHaveURL(/\/juan\/3\/16$/);
});

test('los versículos de una ocasión y la imagen para compartir salen en la NBLA que se lee', async ({ page }) => {
  await simularApiBible(page);
  await leyendoEn(page, 'nbla');
  await page.goto('/ocasiones?ocasion=cumpleanos');
  // La lista fija viene en la RV1909 y se muestra en la versión elegida
  await expect(texto(page, nbla('psa', 118, 24))).toBeVisible();
  await texto(page, nbla('psa', 118, 24)).click();
  await expect(texto(page, /^Compartir Salmos 118:24/)).toBeVisible();
  await expect(texto(page, /Salmos 118:24 \(NBLA\)/)).toBeVisible();
  await captura(page, '4-ocasion-nbla');
});

test('el pasaje del día en pareja se lee en la versión elegida', async ({ page, request }) => {
  await leyendoEn(page, 'bes');
  await conSesion(page, await cuentaNueva(request, 'Lectora BES'));
  await page.goto('/pareja/cordon/1');
  await expect(texto(page, /· BES$/)).toBeVisible();
});
