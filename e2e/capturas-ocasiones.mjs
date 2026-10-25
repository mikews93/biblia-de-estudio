// Capturas de «Para alguien» (ocasiones) y de la línea de contexto al pie (no es una prueba):
// node e2e/capturas-ocasiones.mjs <carpeta>, con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `ocasiones-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
  })
).json();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: 1280, height: 860 }, acceptDownloads: true, ...scheme }
      : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, acceptDownloads: true, ...scheme },
  );
  const p = await ctx.newPage();
  await p.addInitScript((cu) => {
    localStorage.setItem('cuenta', cu);
    localStorage.setItem('permiso-ia', 'si');
  }, JSON.stringify(cuenta));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(800);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const toca = async (loc) => {
  await loc.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
  await wait(250);
  await loc.click({ force: true });
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/ocasiones`);
  await p.getByText('¿A quién le hace falta hoy un versículo?').waitFor();
  await wait(1200);
  await shot(p, `${prefix}-1-ocasiones`);

  await p.getByRole('radio', { name: /^Enfermedad/ }).click();
  await p.getByText('Versículos para enviar').waitFor();
  await wait(1200);
  await shot(p, `${prefix}-2-enfermedad`);

  await p.getByLabel('Lo que está pasando').fill('Mi tía empieza la quimioterapia el lunes y tiene miedo');
  await p.getByRole('button', { name: 'Buscar versículos' }).click();
  await p.getByText('Para lo que contaste').waitFor();
  await p.getByText('Para lo que contaste').scrollIntoViewIfNeeded();
  await shot(p, `${prefix}-3-con-ia`);

  await toca(p.getByRole('button', { name: 'Enviar Isaías 41:10' }));
  await p.getByText('Compartir Isaías 41:10').waitFor();
  await wait(1200);
  await toca(p.getByRole('tab', { name: 'Estudio' }));
  await toca(p.getByRole('button', { name: 'Sugerir desde los comentarios' }));
  await wait(1500);
  await p.getByText('Compartir Isaías 41:10').scrollIntoViewIfNeeded();
  await shot(p, `${prefix}-4-imagen-ocasion`);
  await toca(p.getByRole('button', { name: 'Sugerir desde los comentarios' }));
  await shot(p, `${prefix}-5-contexto`);
  if (prefix === 'm') {
    const [d] = await Promise.all([p.waitForEvent('download'), p.getByText('Descargar', { exact: true }).click()]);
    await d.saveAs(`${OUT}/imagen-ocasion-enfermedad.png`);
  }
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });
await browser.close();
