// Capturas del léxico de UBS, el diccionario Tyndale, «¿Qué era?» y /fuentes (no es una prueba):
// node e2e/capturas-fuentes-nuevas.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    localStorage.setItem('bienvenida-vista', '1');
    localStorage.setItem('permiso-ia', 'si');
  });
  return p;
}
const shot = async (p, name) => {
  await wait(900);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  // El versículo: pestaña Interlineal con una palabra tocada, y pestaña Diccionario
  await p.goto(`${BASE}/juan/3/16`);
  await p.getByRole('button', { name: 'Referencias' }).last().click();
  await p.getByTestId('tsk-toggle').first().click();
  await shot(p, `${prefix}-0-referencias-treasury`);
  await p.getByRole('tab', { name: 'Diccionario' }).click();
  await p.getByText('Unigénito', { exact: true }).first().waitFor();
  await shot(p, `${prefix}-1-versiculo-diccionario`);
  await p.getByRole('tab', { name: 'Interlineal' }).click();
  await p.getByText('amó', { exact: true }).first().click();
  await p.getByText('Diccionario de las Sociedades Bíblicas Unidas').first().waitFor();
  await shot(p, `${prefix}-2-palabra-ubs`);
  await p.getByText(/Ver los otros/).first().click().catch(() => {});
  await shot(p, `${prefix}-2b-otros-sentidos`);
  // Una planta: «hisopo» en Juan 19:29
  await p.goto(`${BASE}/juan/19/29`);
  await p.getByRole('button', { name: 'Referencias' }).last().click();
  await p.getByRole('tab', { name: 'Interlineal' }).click();
  await p.getByText('a (caña de) hisopo', { exact: true }).first().click();
  await p.getByText('¿Qué era?').first().waitFor();
  await shot(p, `${prefix}-8-que-era`);
  await p.getByText('¿Qué era?').first().click();
  await wait(6000);
  await shot(p, `${prefix}-9-objeto`);
  await p.goto(`${BASE}/diccionario`);
  await p.getByText('Para empezar').waitFor();
  await shot(p, `${prefix}-3-diccionario`);
  await p.getByPlaceholder('Busca: gracia, efod, Getsemaní…').fill('getsemani');
  await shot(p, `${prefix}-4-busqueda`);
  await p.getByText('Getsemaní', { exact: true }).first().click();
  await p.getByText('angustia', { exact: false }).first().waitFor();
  await shot(p, `${prefix}-5-articulo`);
  await p.goto(`${BASE}/buscar?q=${encodeURIComponent('efod')}`);
  await p.getByText('Diccionario bíblico Tyndale').first().waitFor({ timeout: 20000 }).catch(() => {});
  await shot(p, `${prefix}-6-buscador`);
  await p.goto(`${BASE}/fuentes`);
  await p.getByText('Diccionarios y léxicos').waitFor();
  await shot(p, `${prefix}-7-fuentes`);
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
