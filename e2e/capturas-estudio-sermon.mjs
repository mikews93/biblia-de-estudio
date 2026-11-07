// Capturas de «Convertir un estudio profundo en sermón» (no es una prueba): node e2e/capturas-estudio-sermon.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts), que simula la IA (e2e/support/mock-anthropic.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const PREGUNTA = '¿Por qué Nicodemo vino a Jesús de noche?';

const cuenta = await (
  await fetch(`${BASE}/api/comunidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'registrarse', nombre: 'Mike', correo: `capturas-${Date.now()}@prueba.test`, clave: 'clave-segura-1' }),
  })
).json();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
async function page({ desktop = false, theme } = {}) {
  const scheme = { colorScheme: theme === 'oscuro' ? 'dark' : 'light', locale: 'es-CO', deviceScaleFactor: 2 };
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript((cu) => {
    localStorage.setItem('cuenta', cu);
    localStorage.setItem('permiso-ia', 'si');
    localStorage.setItem('ajustes', JSON.stringify({ enfoque: 'profundo' }));
  }, JSON.stringify(cuenta));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(700);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
const bajar = async (p, px, x = 200, y = 500) => {
  await p.mouse.move(x, y);
  await p.mouse.wheel(0, px);
};
const alInicio = (p, texto) =>
  p.evaluate((t) => {
    const el = [...document.querySelectorAll('div')].filter((d) => d.textContent === t && d.offsetParent).at(-1);
    el?.scrollIntoView({ block: 'start' });
  }, texto);

async function recorrido(prefix, opts, todas) {
  const p = await page(opts);
  const x = opts.desktop ? 640 : 200;
  await p.goto(`${BASE}/juan/3/16`);
  await p.getByRole('button', { name: 'Estudiar', exact: true }).click();
  const estudio = p.getByRole('dialog').filter({ hasText: 'ESTUDIO' });
  await estudio.getByText('Estudio simulado del pasaje').waitFor();
  await estudio.getByPlaceholder('Pregunta sobre Juan 3:16').fill(PREGUNTA);
  await estudio.getByLabel('Enviar pregunta').click();
  await estudio.getByText(`Respuesta simulada a «${PREGUNTA}».`).first().waitFor();
  await wait(1500);
  await bajar(p, 5000, x);
  await shot(p, `${prefix}-1-estudio`);
  await estudio.getByRole('button', { name: 'Convertir este estudio en un sermón' }).click();
  await p.getByText('DESDE TU ESTUDIO PROFUNDO').waitFor();
  await shot(p, `${prefix}-2-desde-estudio`);
  await p.getByRole('button', { name: 'Investigar esto' }).click();
  await p.getByText('LO QUE PREGUNTASTE AL ESTUDIAR').waitFor({ timeout: 30000 });
  await p.getByRole('button', { name: 'Dar la dirección' }).waitFor({ timeout: 30000 });
  await wait(1000);
  await alInicio(p, 'MOMENTO HISTÓRICO');
  await shot(p, `${prefix}-3-momento-protagonistas`);
  if (todas) {
    await alInicio(p, 'LO QUE PREGUNTASTE AL ESTUDIAR');
    await shot(p, `${prefix}-4-preguntas`);
  }
  await p.context().close();
}

await recorrido('m', {}, true);
await recorrido('o', { theme: 'oscuro' }, true);
await recorrido('d', { desktop: true }, false);
await browser.close();
