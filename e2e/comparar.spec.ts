// Comparar versiones: el versículo en varias versiones desde su panel, con las palabras que cambian marcadas, y el
// capítulo entero en columnas (escritorio) o versículo por versículo (teléfono). Las versiones con derechos se
// comparan igual, con su aviso. API.Bible se simula, como en versiones-licencia.spec.ts.

import type { Locator, Page } from '@playwright/test';

import { LICENSED } from '../src/lib/licenciadas';
import { expect, test } from './support/fixtures';

const visible = (l: Locator) => l.filter({ visible: true });
const texto = (page: Page, t: string) => visible(page.getByText(t, { exact: false })).first();
const captura = (page: Page, nombre: string) =>
  page.screenshot({ path: `test-results/capturas/comparar-${nombre}-${test.info().project.name}.png` });

const NBLA = LICENSED.find((v) => v.id === 'nbla')!;
const JN316 = 'Porque de tal manera amó Dios al mundo, que dio a Su Hijo unigénito, para que todo aquel que cree en Él no se pierda, sino que tenga vida eterna.';

async function simularApiBible(page: Page) {
  await page.route('**/api/biblia?*', async (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get('versiones')) return route.fulfill({ json: { versions: [{ ...NBLA, bibleId: undefined, licensed: true }] } });
    const verses = Array.from({ length: 36 }, (_, i) => [i + 1, i === 15 ? JN316 : `Texto NBLA simulado del versículo ${i + 1}.`]);
    return route.fulfill({ json: { verses, fums: null } });
  });
}

test('el versículo se compara en varias versiones desde su panel', async ({ page }) => {
  await simularApiBible(page);
  await page.goto('/juan/3/16');
  await page.waitForTimeout(600);
  await captura(page, '0-acciones');
  await visible(page.getByRole('button', { name: 'Versiones', exact: true })).click();

  // Las versiones por omisión, con la que se lee primero
  await expect(texto(page, 'Estás leyendo')).toBeVisible();
  for (const name of ['Reina Valera Gómez', 'Palabra de Dios para ti', 'La Biblia en Español Sencillo'])
    await expect(visible(page.getByRole('checkbox', { name, checked: true }))).toBeVisible();
  await expect(texto(page, 'Porque de tal manera amó Dios al mundo')).toBeVisible();

  // Se añade la NBLA (con derechos): aparece con su aviso
  await visible(page.getByRole('checkbox', { name: 'Nueva Biblia de las Américas' })).click();
  await expect(texto(page, JN316)).toBeVisible();
  await expect(texto(page, 'The Lockman Foundation')).toBeVisible();
  await expect(visible(page.getByRole('link', { name: /NuevaBiblia\.com/ })).first()).toBeVisible();
  await page.waitForTimeout(500);
  await captura(page, '1-versiculo');

  // Y se recuerda para la próxima vez
  const ajustes = await page.evaluate(() => JSON.parse(localStorage.getItem('ajustes') ?? '{}'));
  expect(ajustes.comparar).toContain('nbla');
});

test('el capítulo entero se compara versículo a versículo y lleva al lector', async ({ page }) => {
  await simularApiBible(page);
  await page.goto('/juan/3');
  await page.waitForTimeout(600);
  await captura(page, '0-lector');
  await visible(page.getByRole('button', { name: 'Comparar versiones de este capítulo' })).click();
  await expect(page).toHaveURL(/\/comparar\/juan\/3$/);
  await expect(texto(page, 'COMPARAR VERSIONES')).toBeVisible();
  await expect(texto(page, 'Juan 3')).toBeVisible();
  await expect(visible(page.getByRole('link', { name: 'Abrir el versículo 36 en el lector' }))).toBeAttached();
  await page.waitForTimeout(600);
  await captura(page, '2-capitulo');

  // Directo a un versículo, en oscuro
  await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('ajustes') ?? '{}');
    localStorage.setItem('ajustes', JSON.stringify({ ...a, theme: 'oscuro', comparar: ['rv1909', 'rvg', 'pdt', 'nbla'] }));
  });
  await page.goto('/comparar/juan/3?v=16');
  await expect(texto(page, JN316)).toBeVisible();
  await page.waitForTimeout(800);
  await captura(page, '3-oscuro');

  await visible(page.getByRole('link', { name: 'Abrir el versículo 16 en el lector' })).click();
  await expect(page).toHaveURL(/\/juan\/3\/16$/);
});

test('se pasa al capítulo siguiente sin salir de la comparación', async ({ page }) => {
  await page.goto('/comparar/juan/3');
  await visible(page.getByRole('button', { name: 'Capítulo siguiente' })).click();
  await expect(page).toHaveURL(/\/comparar\/juan\/4$/);
  await expect(texto(page, 'Juan 4')).toBeVisible();
});
