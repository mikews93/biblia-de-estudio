// ¿Por qué difieren las versiones?: debajo de Comparar, la palabra griega o hebrea detrás de cada diferencia, con
// cómo la dice cada versión, y las diferencias entre manuscritos. Todo se calcula en el navegador, sin IA: la NBLA
// (con derechos, simulada como en comparar.spec.ts) entra en la comparación sin salir hacia ninguna función.

import type { Locator, Page } from '@playwright/test';

import { LICENSED } from '../src/lib/licenciadas';
import { expect, test } from './support/fixtures';

const visible = (l: Locator) => l.filter({ visible: true });
const texto = (page: Page, t: string) => visible(page.getByText(t, { exact: false })).first();
const captura = (page: Page, nombre: string) =>
  page.screenshot({ path: `test-results/capturas/diferencias-${nombre}-${test.info().project.name}.png` });

const NBLA = LICENSED.find((v) => v.id === 'nbla')!;
const JN316 =
  'Porque de tal manera amó Dios al mundo, que dio a Su Hijo unigénito, para que todo aquel que cree en Él no se pierda, sino que tenga vida eterna.';

async function simularApiBible(page: Page) {
  await page.route('**/api/biblia?*', async (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get('versiones')) return route.fulfill({ json: { versions: [{ ...NBLA, bibleId: undefined, licensed: true }] } });
    const verses = Array.from({ length: 36 }, (_, i) => [i + 1, i === 15 ? JN316 : `Texto NBLA simulado del versículo ${i + 1}.`]);
    return route.fulfill({ json: { verses, notes: {}, fums: null } });
  });
}

test('en el panel del versículo, la palabra griega detrás de cada diferencia', async ({ page }) => {
  await simularApiBible(page);
  // Ninguna petición a la IA ni a otra función lleva texto con derechos
  const enviados: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') enviados.push(r.postData() ?? '');
  });
  await page.goto('/juan/3/16');
  await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('ajustes') ?? '{}');
    localStorage.setItem('ajustes', JSON.stringify({ ...a, comparar: ['rv1909', 'rvg', 'bes', 'nbla'] }));
  });
  await page.reload();
  await visible(page.getByRole('button', { name: 'Versiones', exact: true })).click();

  await expect(texto(page, '¿Por qué difieren?')).toBeVisible();
  await expect(texto(page, 'La palabra griega detrás de cada diferencia')).toBeVisible();
  // μονογενής: «unigénito» en la RV1909, la RVG y la NBLA; «único» en la BES, con su nota
  await expect(texto(page, 'μονογενῆ')).toBeVisible();
  await expect(texto(page, 'Monogenés puede leerse como «unigénito»')).toBeVisible();
  await texto(page, 'μονογενῆ').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await captura(page, '1-versiculo');

  // La palabra abre su ficha del interlineal
  await visible(page.getByRole('button', { name: 'Ver la palabra monogenē' })).click();
  await expect(texto(page, 'Forma de diccionario')).toBeVisible();
  await page.keyboard.press('Escape');

  expect(enviados.filter((b) => b.includes('Su Hijo unigénito'))).toEqual([]);
});

test('en el capítulo, cada versículo dice si difiere y por qué, también entre manuscritos', async ({ page }) => {
  await page.goto('/mateo/6');
  await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('ajustes') ?? '{}');
    localStorage.setItem('ajustes', JSON.stringify({ ...a, comparar: ['rv1909', 'rvg', 'bes', 'pdt'] }));
  });
  await page.goto('/comparar/mateo/6?v=13');
  // El versículo elegido llega abierto: la doxología no está en los manuscritos más antiguos
  await expect(texto(page, 'Diferencia de manuscritos')).toBeVisible();
  await expect(texto(page, 'porque tuyo es el reino')).toBeVisible();
  await expect(texto(page, 'Por eso PDT no las incluye')).toBeVisible();
  await page.waitForTimeout(600);
  await captura(page, '2-manuscritos');

  // Los demás versículos, cerrados con su botón
  const botones = visible(page.getByRole('button', { name: /¿Por qué difieren\?/ }));
  expect(await botones.count()).toBeGreaterThan(3);

  // Un versículo entero que no está en todos los manuscritos, en oscuro
  await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('ajustes') ?? '{}');
    localStorage.setItem('ajustes', JSON.stringify({ ...a, theme: 'oscuro' }));
  });
  await page.goto('/comparar/hechos/8?v=37');
  await expect(texto(page, 'Versículo en disputa')).toBeVisible();
  await expect(texto(page, 'Incluyen el versículo')).toBeVisible();
  await expect(texto(page, 'No lo incluye')).toBeVisible();
  await page.waitForTimeout(600);
  await captura(page, '3-versiculo-oscuro');
});

test('en el Antiguo Testamento, la palabra hebrea: el nombre de Dios en el Salmo 23', async ({ page }) => {
  await page.goto('/salmos/23');
  await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('ajustes') ?? '{}');
    localStorage.setItem('ajustes', JSON.stringify({ ...a, comparar: ['rv1909', 'bes', 'pdt', 'blm'] }));
  });
  await page.goto('/comparar/salmos/23?v=1');
  await expect(texto(page, 'יְהוָה')).toBeVisible();
  await expect(texto(page, 'Es el nombre propio de Dios')).toBeVisible();
  await expect(texto(page, 'Yahvé')).toBeVisible();
  await page.waitForTimeout(600);
  await captura(page, '4-salmo-23');
});
