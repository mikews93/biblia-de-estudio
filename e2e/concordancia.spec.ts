// Concordancia: desde una palabra del interlineal, todas las veces que aparece en la Biblia, con cómo se traduce,
// en qué libros y cada versículo de la RV1909, que lleva al lector. Griego (ἀγαπάω) y hebreo (חֶסֶד).

import type { Locator, Page } from '@playwright/test';

import { glossKey } from '../src/lib/concordancia';
import { expect, test } from './support/fixtures';

type Concordance = { lemma: string; translit: string; related: string[]; uses: [string, string, string][] };

const visible = (l: Locator) => l.filter({ visible: true });
const texto = (page: Page, t: string) => visible(page.getByText(t, { exact: false })).first();
const captura = (page: Page, nombre: string) =>
  page.screenshot({ path: `test-results/capturas/concordancia-${nombre}-${test.info().project.name}.png` });

test('la palabra «amó» de Juan 3:16 abre todas las veces que aparece ἀγαπάω', async ({ page, request }) => {
  const agapao: Concordance = await (await request.get('/data/concordance/G0025.json')).json();
  const versos = new Set(agapao.uses.map(([ref]) => ref)).size;
  const jn3: Record<string, string[][]> = await (await request.get('/data/interlinear/jhn/3.json')).json();
  const amo = jn3['16'].find((w) => w[6] === 'G0025')!;

  await page.goto('/juan/3/16');
  await visible(page.getByRole('button', { name: 'Original', exact: true })).click();
  await visible(page.getByText(amo[0], { exact: true })).click();
  const enlace = visible(page.getByRole('link', { name: /Todas las veces en la Biblia/ }));
  await expect(enlace).toContainText(`${agapao.uses.length} veces`);
  await enlace.scrollIntoViewIfNeeded();
  await captura(page, '0-interlineal');
  await enlace.click();

  await expect(page).toHaveURL(/\/concordancia\/G0025\?desde=jhn\.3\.16/);
  await expect(visible(page.getByText(agapao.lemma, { exact: true })).first()).toBeVisible();
  await expect(texto(page, `${versos} versículos`)).toBeVisible();
  await expect(texto(page, 'Strong G25')).toBeVisible();
  // El versículo del que se vino va arriba, marcado, con la traducción resaltada en la RV1909
  const aqui = visible(page.getByRole('link', { name: 'Juan 3:16' })).first();
  await expect(aqui).toContainText('Estás aquí');
  await expect(aqui).toContainText('Porque de tal manera amó Dios al mundo');
  await page.waitForTimeout(600);
  await captura(page, '1-agapao');
  await visible(page.getByRole('button', { name: /^Juan: \d+ veces/ })).click();
  await expect(texto(page, `${new Set(agapao.uses.filter(([r]) => r.startsWith('jhn.')).map(([r]) => r)).size} versículos`)).toBeVisible();

  // Filtro por traducción: solo los versículos donde se traduce «amando» (con sus auxiliares)
  await visible(page.getByRole('button', { name: 'Quitar el filtro' })).click();
  const amando = agapao.uses.filter(([, , g]) => glossKey(g) === 'amando');
  await visible(page.getByRole('button', { name: /^amando, \d+ veces/ })).click();
  await expect(texto(page, `${new Set(amando.map(([r]) => r)).size} versículos`)).toBeVisible();
  await expect(texto(page, '«amando»')).toBeVisible();

  // Una fila lleva al versículo en el lector
  await visible(page.getByRole('button', { name: 'Quitar el filtro' })).click();
  await visible(page.getByRole('link', { name: 'Mateo 5:43' })).click();
  await expect(page).toHaveURL(/\/mateo\/5\/43/);
});

test('la concordancia hebrea de חֶסֶד enseña sus traducciones y la otra acepción', async ({ page, request }) => {
  const hesed: Concordance = await (await request.get('/data/concordance/H2617A.json')).json();
  await page.goto('/concordancia/h2617a');
  await expect(visible(page.getByText(hesed.lemma, { exact: true })).first()).toBeVisible();
  await expect(texto(page, 'chesed')).toBeVisible();
  await expect(visible(page.getByRole('button', { name: /^misericordia, \d+ veces/ }))).toBeVisible();
  await expect(visible(page.getByRole('button', { name: /^Salmos: \d+ veces/ }))).toBeVisible();
  await page.waitForTimeout(600);
  await captura(page, '2-hesed');
  await visible(page.getByRole('link', { name: 'H2617B' })).click();
  await expect(texto(page, '2 versículos')).toBeVisible();
});

test('en modo oscuro se lee bien', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/concordancia/G0026?desde=1jn.4.8');
  await expect(texto(page, 'Estás aquí')).toBeVisible();
  await page.waitForTimeout(800);
  await captura(page, '3-oscuro');
});

test('un número que no existe lo dice', async ({ page }) => {
  await page.goto('/concordancia/juan');
  await expect(texto(page, 'No encontramos esta palabra')).toBeVisible();
});
