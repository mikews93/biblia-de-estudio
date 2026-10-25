// Capturas de la búsqueda rápida por idea (no es una prueba): node e2e/capturas-buscar-rapido.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts), con dist/data/semantica/ (npm run semantica)
// y, si huggingface.co no se abre, SEMANTICA_MODELOS=<carpeta con Xenova/multilingual-e5-small>.
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `capturas-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
  })
).json();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO' };
  const ctx = await browser.newContext(
    desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
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
const buscar = async (p, q) => {
  const box = p.getByRole('textbox', { name: 'Buscar una cita, unas palabras o una idea' }).filter({ visible: true });
  await box.fill(q);
  await box.press('Enter');
  await p.getByText(`para «${q}»`).filter({ visible: true }).first().waitFor({ timeout: 60_000 });
};

async function recorrido(prefix, opts, todas) {
  const p = await page(opts);
  await p.goto(`${BASE}/buscar`);
  await buscar(p, 'cuando tengo miedo');
  await shot(p, `${prefix}-1-miedo`);
  if (todas) {
    await buscar(p, 'Echa sobre él tu ansiedad');
    await shot(p, `${prefix}-2-fragmento`);
    await buscar(p, 'perdonar a quien me hirió');
    await p.getByRole('button', { name: 'Afinar con la IA' }).filter({ visible: true }).click();
    await p.getByText('Elegidos por la IA').filter({ visible: true }).waitFor({ timeout: 30_000 });
    await shot(p, `${prefix}-3-afinado`);
  }
  await p.context().close();
}

await recorrido('m', {}, true);
await recorrido('o', { theme: 'oscuro' }, false);
await recorrido('d', { desktop: true }, false);
await browser.close();
