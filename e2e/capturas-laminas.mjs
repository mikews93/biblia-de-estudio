// Capturas del carrusel de láminas para Historias (no es una prueba):
// node e2e/capturas-laminas.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function recorrido(prefix, { desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: 1280, height: 860 }, acceptDownloads: true, ...scheme }
      : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, acceptDownloads: true, ...scheme },
  );
  const p = await ctx.newPage();
  await p.goto(`${BASE}/salmos/23`);
  await p.getByText('nada me faltará').click();
  await p.getByRole('button', { name: 'Compartir', exact: true }).click();
  await p.getByRole('radio', { name: 'Fondo Montes' }).click();
  await p.getByRole('tab', { name: 'Letra' }).click();
  await p.getByRole('radio', { name: 'Letra Elegante' }).click();
  await p.getByRole('radio', { name: 'Carrusel' }).click();
  await p.getByRole('radio', { name: '¿Te ha pasado?' }).click();
  await p.getByLabel('Pregunta para empezar').fill('¿Sientes que algo te falta?');
  await p.getByRole('tab', { name: 'Estudio' }).click();
  await p.getByRole('radio', { name: /pastor/ }).first().click();
  await p.getByLabel('Lámina 3: A fondo').waitFor();
  await wait(1800);
  await p.getByText('Compartir Salmos 23:1').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/${prefix}-1-carrusel.png` });
  if (prefix === 'm') {
    const nombres = [];
    p.on('download', async (d) => {
      nombres.push(d.suggestedFilename());
      await d.saveAs(`${OUT}/lamina-${d.suggestedFilename()}`);
    });
    await p.getByText('Descargar', { exact: true }).click();
    await wait(3000);
  }
  await ctx.close();
}
await recorrido('m');
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
