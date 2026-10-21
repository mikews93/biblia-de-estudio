// Versiones con derechos (NBLA, NTV…) por API.Bible: aparecen en su propio grupo solo si la clave las tiene, se leen
// con su aviso de derechos enlazado, cada lectura se informa a FUMS y no se ofrecen para descargar.
// API.Bible se simula: la función de verdad necesita API_BIBLE_KEY y red.

import type { Locator, Page } from '@playwright/test';

import { LICENSED } from '../src/lib/licenciadas';
import { expect, test } from './support/fixtures';

const visible = (l: Locator) => l.filter({ visible: true });
const texto = (page: Page, t: string) => visible(page.getByText(t, { exact: false })).first();

const NBLA = LICENSED.find((v) => v.id === 'nbla')!;
const NTV = LICENSED.find((v) => v.id === 'ntv')!;
const JN316 = 'Porque de tal manera amó Dios al mundo, que dio a Su Hijo unigénito, para que todo aquel que cree en Él no se pierda, sino que tenga vida eterna.';

async function simularApiBible(page: Page) {
  const fums: string[] = [];
  await page.route('**/api/biblia?*', async (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get('versiones')) {
      return route.fulfill({ json: { versions: [NBLA, NTV].map(({ bibleId: _, ...v }) => ({ ...v, licensed: true })) } });
    }
    const verses = Array.from({ length: 21 }, (_, i) => [i + 1, i === 15 ? JN316 : `Texto NBLA simulado del versículo ${i + 1}.`]);
    return route.fulfill({ json: { verses, copyright: NBLA.credit, fums: `ficha-${q.get('book')}-${q.get('chapter')}` } });
  });
  await page.route('https://fums.api.bible/**', (route) => {
    fums.push(new URL(route.request().url()).searchParams.get('t') ?? '');
    return route.fulfill({ status: 200, body: '' });
  });
  return fums;
}

test('la NBLA se elige en su grupo, se lee con su aviso de derechos y se informa a FUMS', async ({ page }) => {
  const fums = await simularApiBible(page);
  await page.goto('/juan/3/16');

  await visible(page.getByRole('button', { name: 'Versión: Reina-Valera 1909. Cambiar versión' })).click();
  await expect(texto(page, 'Con permiso de sus editores · en línea')).toBeVisible();
  await expect(texto(page, 'la IA y el audio usan siempre las libres')).toBeVisible();
  await page.waitForTimeout(600); // que termine de aparecer
  await page.screenshot({ path: `test-results/capturas/licencia-1-versiones-${test.info().project.name}.png` });
  await visible(page.getByRole('button', { name: /Nueva Biblia de las Américas/ })).click();

  await expect(texto(page, JN316)).toBeVisible();
  await expect(visible(page.getByRole('button', { name: /Cambiar versión/ }))).toHaveText('NBLA');
  const aviso = visible(page.getByRole('link', { name: /The Lockman Foundation/ }));
  await expect(aviso).toBeVisible();
  await expect.poll(() => fums).toContain('ficha-jhn-3');

  // El aviso lleva a la página de la versión
  await page.context().route('https://www.nuevabiblia.com/**', (route) => route.fulfill({ body: 'NBLA' }));
  const popup = page.waitForEvent('popup');
  await aviso.click();
  await expect(await popup).toHaveURL(/nuevabiblia\.com/);

  // La versión se recuerda: el capítulo entero, con el aviso al final
  await page.goto('/juan/3');
  await expect(texto(page, JN316)).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/capturas/licencia-2-lectura-${test.info().project.name}.png` });
  await visible(page.getByRole('link', { name: /The Lockman Foundation/ })).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/capturas/licencia-3-aviso-${test.info().project.name}.png` });
});

test('las versiones con derechos no se ofrecen para descargar', async ({ page }) => {
  await simularApiBible(page);
  await page.goto('/descargas');
  await expect(texto(page, 'NBLA, NTV: sus editores solo permiten leerlas con conexión.')).toBeVisible();
  await expect(visible(page.getByText('Nueva Biblia de las Américas', { exact: true }))).toHaveCount(0);
});

test('sin clave de API.Bible solo aparecen las versiones libres', async ({ page }) => {
  await page.goto('/juan/3/16');
  await visible(page.getByRole('button', { name: 'Versión: Reina-Valera 1909. Cambiar versión' })).click();
  await expect(visible(page.getByRole('button', { name: /La Biblia en Español Sencillo/ }))).toBeVisible();
  await expect(texto(page, 'Con permiso de sus editores')).toBeHidden();
});
