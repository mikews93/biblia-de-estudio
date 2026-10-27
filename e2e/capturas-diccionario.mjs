// Capturas de «Del diccionario bíblico» (no es una prueba): node e2e/capturas-diccionario.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts), que simula la IA (e2e/support/mock-anthropic.ts).
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
    desktop ? { viewport: { width: 1280, height: 860 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme },
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
const bajar = async (p, px) => {
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, px);
};

async function recorrido(prefix, opts) {
  const p = await page(opts);
  await p.goto(`${BASE}/buscar?q=${encodeURIComponent('Getsemaní')}`);
  await p.getByText('Del diccionario bíblico').first().waitFor();
  await p.getByText('huerto de olivos', { exact: false }).first().waitFor();
  // El aviso de «progreso guardado» se va solo
  await wait(4500);
  await bajar(p, 160);
  await shot(p, `${prefix}-1-palabra`);
  await p.getByText('Leer más').first().click();
  await bajar(p, 200);
  await shot(p, `${prefix}-2-leer-mas`);
  await p.context().close();
}

await recorrido('m', {});
await recorrido('o', { theme: 'oscuro' });
await recorrido('d', { desktop: true });

// Una pregunta: lo que consultó la IA, con el índice por temas
const p = await page();
await p.goto(`${BASE}/preguntar?q=${encodeURIComponent(`¿Qué dice la Biblia sobre la ansiedad? ${Date.now()}`)}`);
await p.getByText('Para pensar').first().waitFor();
await wait(4500);
await p.getByText(/Consultó|Investigó|fuentes/).first().click().catch(() => {});
await shot(p, 'm-3-pregunta-temas');
await browser.close();
