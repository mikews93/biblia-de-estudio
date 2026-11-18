// Capturas de varios versículos elegidos a la vez (no es una prueba): mantener presionado, sumar con toques,
// barra de acciones, imagen, referencias, versiones y comentario con varios.
// node e2e/capturas-varios.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, ...scheme }
      : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
  );
  // Sin la bienvenida de la primera vez
  await ctx.addInitScript(() => localStorage.setItem('bienvenida', '1'));
  return ctx.newPage();
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(700);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const v16 = (p) => p.getByText('Porque de tal manera amó Dios al mundo').first();
const v17 = (p) => p.getByText('Porque no envió Dios á su Hijo al mundo').first();
const v18 = (p) => p.getByText('El que en él cree, no es condenado').first();
const cerrarPanel = (p) => p.getByRole('button', { name: 'Cerrar panel' }).click();

async function recorrido(prefix, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/juan/3`);
  await v16(p).waitFor();
  await wait(800);
  // Un versículo como siempre: el consejo para elegir varios
  await v16(p).click();
  await shot(p, `${prefix}-1-uno-consejo`);
  await p.getByRole('button', { name: 'Quitar selección' }).click();
  // Mantener presionado y tocar otros
  await v16(p).click({ delay: 700 });
  await shot(p, `${prefix}-2-mantener`);
  if (opts.desktop) {
    await v18(p).click({ modifiers: ['Shift'] });
  } else {
    await v17(p).click();
    await v18(p).click();
  }
  await shot(p, `${prefix}-3-tres`);

  await p.getByRole('button', { name: 'Compartir', exact: true }).click();
  await p.getByText('Compartir Juan 3:16-18').waitFor();
  await wait(1500);
  await shot(p, `${prefix}-4-imagen`);
  await p.keyboard.press('Escape');
  await wait(600);
  if (await p.getByText('Compartir Juan 3:16-18').isVisible()) await p.getByRole('button', { name: /Cerrar/ }).first().click();
  await wait(400);

  await p.getByRole('button', { name: /^Referencias/ }).click();
  await wait(1200);
  await shot(p, `${prefix}-5-referencias`);
  await cerrarPanel(p);
  await p.getByRole('button', { name: 'Versiones', exact: true }).click();
  await wait(1500);
  await shot(p, `${prefix}-6-versiones`);
  await p.getByRole('tab', { name: 'Comentario' }).click();
  await wait(1200);
  await shot(p, `${prefix}-7-comentario`);
  await cerrarPanel(p);
  await p.getByRole('button', { name: 'Copiar', exact: true }).click();
  await shot(p, `${prefix}-8-copiado`);
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
