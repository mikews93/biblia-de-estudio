// Capturas de «Preparar un mensaje» con borrador de la IA (no es una prueba): node e2e/capturas-preparar.mjs <carpeta>
// Con el servidor de pruebas corriendo (npx tsx e2e/support/server.ts), que simula la IA (e2e/support/mock-anthropic.ts).
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OUT = process.argv[2];
const ORACION =
  'Siento que los muchachos andan con ansiedad por el futuro, los estudios y el trabajo. En oración me vino Pedro caminando sobre el agua: quiero que vean que Jesús los mandó al barco y que no se hunden mientras lo miran a Él.';

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
  const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 900 }, ...scheme } : { ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, ...scheme });
  const p = await ctx.newPage();
  await p.addInitScript((cu) => {
    localStorage.setItem('cuenta', cu);
    localStorage.setItem('permiso-ia', 'si');
  }, JSON.stringify(cuenta));
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (p, name) => {
  await wait(700);
  await p.screenshot({ path: `${OUT}/${name}.png` });
};
// La pantalla se desplaza dentro de su ScrollView, no en la página: se baja con la rueda.
const bajar = async (p, px) => {
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, px);
};

async function recorrido(prefix, opts, todas) {
  const p = await page(opts);
  await p.goto(`${BASE}/taller`);
  await p.getByText('Preparar un mensaje').first().waitFor();
  await wait(4500);
  if (todas) await shot(p, `${prefix}-0-taller`);
  await p.getByRole('button', { name: /Preparar un mensaje/ }).first().click();
  await p.getByLabel('Lo que Dios te puso').fill(ORACION);
  await shot(p, `${prefix}-1-orar`);
  await p.getByRole('button', { name: 'Investigar esto' }).click();
  await p.getByText('PREDICACIONES EN LA WEB').waitFor({ timeout: 30000 });
  await p.getByRole('button', { name: 'Dar la dirección' }).waitFor({ timeout: 30000 });
  // Marca lo que le sirve
  const estrellas = p.getByRole('checkbox', { name: 'Me sirve' });
  for (const i of [0, 1, 2]) if ((await estrellas.count()) > i) await estrellas.nth(i).click();
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, -5000);
  await shot(p, `${prefix}-2-investigacion`);
  await bajar(p, 800);
  await shot(p, `${prefix}-3-fuentes`);
  if (todas) {
    await bajar(p, 800);
    await shot(p, `${prefix}-3b-vistas`);
    await bajar(p, 800);
    await shot(p, `${prefix}-3c-web`);
  }
  await p.getByRole('button', { name: 'Dar la dirección' }).click();
  await p.getByText('Célula de las 4 E').click();
  await p.getByLabel('Tu dirección para el mensaje').fill('Muy práctico para los jóvenes, que cierre con oración en parejas.');
  await shot(p, `${prefix}-4-direccion`);
  await p.getByRole('button', { name: 'Escribir el borrador' }).click();
  await p.getByRole('button', { name: 'Abrir el borrador para revisarlo' }).waitFor({ timeout: 30000 });
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, -5000);
  await shot(p, `${prefix}-5-escribiendo`);
  await p.getByRole('button', { name: 'Abrir el borrador para revisarlo' }).click();
  await p.getByText('BORRADOR DE LA IA').waitFor();
  await shot(p, `${prefix}-6-borrador`);
  await p.getByRole('button', { name: /Escúchalo/ }).click();
  await shot(p, `${prefix}-7-escuchar`);
  if (todas) {
    await p.getByText('Repaso corto').click();
    await wait(2500);
    await shot(p, `${prefix}-7b-repaso`);
    await bajar(p, 900);
    await shot(p, `${prefix}-8-partes`);
  }
  await p.getByPlaceholder(/Pide un cambio/).fill('Cambia la tercera parte para usar Isaías 43:2 y añade una oración en parejas al final');
  await p.getByRole('button', { name: 'Pedir cambio' }).click();
  await p.getByRole('button', { name: 'Aceptar' }).first().waitFor({ timeout: 30000 });
  await wait(1500);
  await p.getByText('CAMBIOS QUE PEDISTE').scrollIntoViewIfNeeded();
  await p.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.textContent === 'CAMBIOS QUE PEDISTE');
    el?.scrollIntoView({ block: 'start' });
  });
  await shot(p, `${prefix}-9-cambios`);
  if (todas) {
    await bajar(p, 20000);
    await shot(p, `${prefix}-9b-aceptar`);
  }
  await p.context().close();
}

await recorrido('m', {}, true);
await recorrido('o', { theme: 'oscuro' }, false);
await recorrido('d', { desktop: true }, false);
await browser.close();
